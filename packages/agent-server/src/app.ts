import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { dispatch, dispatchMany, SKILL_REGISTRY } from "@pharos-defi-skills/skills";
import type { AgentSkillCall, SkillName } from "@pharos-defi-skills/skills";
import { logger } from "@pharos-defi-skills/skills";
import { apiKeyAuth } from "./middleware/auth";

const log = logger.child("agent-server");

export function createApp() {
  const app = express();

  // ─── Middleware ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Rate limiting — 100 requests per minute per IP
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, slow down." },
    },
  });
  app.use(limiter);

  // API key auth — disabled if AGENT_SERVER_API_KEY is not set
  app.use(apiKeyAuth);

  // Request ID injection
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers["x-request-id"] =
      (req.headers["x-request-id"] as string) ?? uuidv4();
    next();
  });

  // ─── Health ──────────────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "pharos-defi-skills-agent-server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Skill Registry ───────────────────────────────────────────────────────────
  /**
   * GET /skills
   * Returns the full skill registry — Agent frameworks call this first
   * to discover available skills and their input/output schemas.
   */
  app.get("/skills", (_req: Request, res: Response) => {
    res.json({ success: true, data: SKILL_REGISTRY });
  });

  // ─── Single Skill Dispatch ────────────────────────────────────────────────────
  /**
   * POST /skills/invoke
   * Body: { skill: SkillName, params: SkillInput, requestId?: string }
   *
   * The primary endpoint for Agent frameworks. Accepts a standard skill
   * call envelope and returns a typed result envelope.
   *
   * @example
   * POST /skills/invoke
   * {
   *   "skill": "portfolio_snapshot",
   *   "params": { "walletAddress": "0x...", "network": "testnet" }
   * }
   */
  app.post("/skills/invoke", async (req: Request, res: Response) => {
    const requestId =
      (req.headers["x-request-id"] as string) ?? uuidv4();

    const { skill, params } = req.body as Partial<AgentSkillCall>;

    if (!skill || typeof skill !== "string") {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_SKILL",
          message: 'Request body must include a "skill" field.',
        },
      });
    }

    if (!params || typeof params !== "object") {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PARAMS",
          message: 'Request body must include a "params" object.',
        },
      });
    }

    const response = await dispatch({
      skill: skill as SkillName,
      params,
      requestId,
    } as AgentSkillCall);

    const statusCode = response.result.success ? 200 : 422;
    return res.status(statusCode).json(response);
  });

  // ─── Batch Dispatch ───────────────────────────────────────────────────────────
  /**
   * POST /skills/invoke/batch
   * Body: { calls: AgentSkillCall[] }
   *
   * Execute multiple skills in parallel. Useful for Agents that need to
   * gather multiple data points (e.g. portfolio + price) before deciding.
   *
   * @example
   * POST /skills/invoke/batch
   * {
   *   "calls": [
   *     { "skill": "portfolio_snapshot", "params": { "walletAddress": "0x..." } },
   *     { "skill": "gas_estimator", "params": { "transaction": { "from": "0x...", "to": "0x..." }, "checkAffordability": true } }
   *   ]
   * }
   */
  app.post("/skills/invoke/batch", async (req: Request, res: Response) => {
    const { calls } = req.body as { calls?: AgentSkillCall[] };

    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_BATCH",
          message: 'Request body must include a non-empty "calls" array.',
        },
      });
    }

    if (calls.length > 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BATCH_TOO_LARGE",
          message: "Maximum 10 calls per batch request.",
        },
      });
    }

    const responses = await dispatchMany(calls);
    return res.json({ success: true, data: responses });
  });

  // ─── Named Skill Shorthand Routes ─────────────────────────────────────────────
  /**
   * POST /skills/:skillName
   * Shorthand: directly invoke a skill by name without the envelope.
   *
   * @example
   * POST /skills/portfolio_snapshot
   * { "walletAddress": "0x...", "network": "testnet" }
   */
  app.post("/skills/:skillName", async (req: Request, res: Response) => {
    const requestId =
      (req.headers["x-request-id"] as string) ?? uuidv4();
    const { skillName } = req.params;
    const params = req.body;

    const response = await dispatch({
      skill: skillName as SkillName,
      params,
      requestId,
    } as AgentSkillCall);

    const statusCode = response.result.success ? 200 : 422;
    return res.status(statusCode).json(response);
  });

  // ─── 404 ──────────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found. Available: GET /skills, POST /skills/invoke, POST /skills/invoke/batch, POST /skills/:skillName",
      },
    });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error("Unhandled error", { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: err.message ?? "An unexpected error occurred.",
      },
    });
  });

  return app;
}
