import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Agent Server — /health", () => {
  it("should return 200 and status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("pharos-defi-skills-agent-server");
  });
});

describe("Agent Server — GET /skills", () => {
  it("should return the skill registry", async () => {
    const res = await request(app).get("/skills");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skills).toHaveLength(4);
    expect(res.body.data.skills.map((s: { name: string }) => s.name)).toEqual([
      "portfolio_snapshot",
      "token_price_feed",
      "gas_estimator",
      "token_swap",
    ]);
  });

  it("registry should contain input and output schemas for each skill", async () => {
    const res = await request(app).get("/skills");
    for (const skill of res.body.data.skills) {
      expect(skill.inputSchema).toBeDefined();
      expect(skill.outputSchema).toBeDefined();
      expect(skill.description).toBeTruthy();
      expect(skill.version).toBeTruthy();
    }
  });
});

describe("Agent Server — POST /skills/invoke", () => {
  it("should return 400 when skill field is missing", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .send({ params: { walletAddress: "0x123" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_SKILL");
  });

  it("should return 400 when params field is missing", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .send({ skill: "portfolio_snapshot" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_PARAMS");
  });

  it("should return 422 for unknown skill", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .send({ skill: "does_not_exist", params: {} });
    expect(res.status).toBe(422);
    expect(res.body.result.success).toBe(false);
    expect(res.body.result.error.code).toBe("UNKNOWN_SKILL");
  });

  it("should return 422 for invalid wallet address", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .send({
        skill: "portfolio_snapshot",
        params: { walletAddress: "not-valid" },
      });
    expect(res.status).toBe(422);
    expect(res.body.result.success).toBe(false);
  });

  it("should include durationMs in every response", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .send({
        skill: "portfolio_snapshot",
        params: { walletAddress: "not-valid" },
      });
    expect(typeof res.body.durationMs).toBe("number");
  });

  it("should echo the requestId when provided", async () => {
    const res = await request(app)
      .post("/skills/invoke")
      .set("x-request-id", "test-req-001")
      .send({
        skill: "portfolio_snapshot",
        params: { walletAddress: "not-valid" },
      });
    expect(res.body.requestId).toBe("test-req-001");
  });
});

describe("Agent Server — POST /skills/invoke/batch", () => {
  it("should return 400 for empty calls array", async () => {
    const res = await request(app)
      .post("/skills/invoke/batch")
      .send({ calls: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BATCH");
  });

  it("should return 400 for batch larger than 10", async () => {
    const calls = Array(11).fill({
      skill: "portfolio_snapshot",
      params: { walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    });
    const res = await request(app)
      .post("/skills/invoke/batch")
      .send({ calls });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BATCH_TOO_LARGE");
  });

  it("should return results array matching calls length", async () => {
    const res = await request(app)
      .post("/skills/invoke/batch")
      .send({
        calls: [
          {
            skill: "portfolio_snapshot",
            params: { walletAddress: "not-valid-1" },
          },
          {
            skill: "portfolio_snapshot",
            params: { walletAddress: "not-valid-2" },
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe("Agent Server — POST /skills/:skillName (shorthand)", () => {
  it("should invoke portfolio_snapshot via shorthand route", async () => {
    const res = await request(app)
      .post("/skills/portfolio_snapshot")
      .send({ walletAddress: "not-valid" });
    expect([200, 422]).toContain(res.status);
    expect(res.body.skill).toBe("portfolio_snapshot");
  });
});

describe("Agent Server — 404", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Agent Server — Auth middleware", () => {
  const ORIGINAL_KEY = process.env.AGENT_SERVER_API_KEY;

  afterEach(() => {
    // Restore env after each test
    if (ORIGINAL_KEY === undefined) {
      delete process.env.AGENT_SERVER_API_KEY;
    } else {
      process.env.AGENT_SERVER_API_KEY = ORIGINAL_KEY;
    }
  });

  it("should allow all requests when AGENT_SERVER_API_KEY is not set", async () => {
    delete process.env.AGENT_SERVER_API_KEY;
    const appNoAuth = createApp();
    const res = await request(appNoAuth)
      .post("/skills/invoke")
      .send({ skill: "portfolio_snapshot", params: { walletAddress: "bad" } });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("should return 401 when API key is required but missing", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth)
      .post("/skills/invoke")
      .send({ skill: "portfolio_snapshot", params: { walletAddress: "bad" } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_API_KEY");
  });

  it("should return 403 when wrong API key is provided", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth)
      .post("/skills/invoke")
      .set("x-api-key", "wrong-key")
      .send({ skill: "portfolio_snapshot", params: { walletAddress: "bad" } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INVALID_API_KEY");
  });

  it("should accept correct API key via x-api-key header", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth)
      .post("/skills/invoke")
      .set("x-api-key", "test-secret-key")
      .send({ skill: "portfolio_snapshot", params: { walletAddress: "bad" } });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("should accept correct API key via Authorization Bearer header", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth)
      .post("/skills/invoke")
      .set("Authorization", "Bearer test-secret-key")
      .send({ skill: "portfolio_snapshot", params: { walletAddress: "bad" } });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("should always allow GET /health without auth", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth).get("/health");
    expect(res.status).toBe(200);
  });

  it("should always allow GET /skills without auth", async () => {
    process.env.AGENT_SERVER_API_KEY = "test-secret-key";
    const appWithAuth = createApp();
    const res = await request(appWithAuth).get("/skills");
    expect(res.status).toBe(200);
  });
});
