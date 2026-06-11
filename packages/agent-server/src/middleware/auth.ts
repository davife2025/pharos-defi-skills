import { Request, Response, NextFunction } from "express";
import { logger } from "@pharos-defi-skills/skills";

const log = logger.child("auth");

/**
 * API key authentication middleware.
 *
 * If AGENT_SERVER_API_KEY is set in the environment, all requests to
 * protected routes must include it as either:
 *   - Header: x-api-key: <key>
 *   - Header: Authorization: Bearer <key>
 *
 * If AGENT_SERVER_API_KEY is NOT set, auth is disabled (open access).
 * This allows zero-config local development while protecting production.
 *
 * Routes that are always public (no auth required):
 *   GET /health
 *   GET /skills  (discovery should always be open)
 */

const PUBLIC_ROUTES: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/skills" },
];

function isPublicRoute(req: Request): boolean {
  return PUBLIC_ROUTES.some(
    (r) => r.method === req.method && req.path === r.path
  );
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const requiredKey = process.env.AGENT_SERVER_API_KEY;

  // Auth disabled — open access
  if (!requiredKey) {
    next();
    return;
  }

  // Public routes bypass auth
  if (isPublicRoute(req)) {
    next();
    return;
  }

  // Extract key from headers
  const fromHeader = req.headers["x-api-key"] as string | undefined;
  const fromBearer = (req.headers["authorization"] as string | undefined)
    ?.replace(/^Bearer\s+/i, "");

  const providedKey = fromHeader ?? fromBearer;

  if (!providedKey) {
    log.warn("Auth rejected — no API key provided", {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      success: false,
      error: {
        code: "MISSING_API_KEY",
        message:
          "This server requires an API key. " +
          "Provide it via the x-api-key header or Authorization: Bearer <key>.",
      },
    });
    return;
  }

  if (providedKey !== requiredKey) {
    log.warn("Auth rejected — invalid API key", {
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "The provided API key is invalid.",
      },
    });
    return;
  }

  next();
}
