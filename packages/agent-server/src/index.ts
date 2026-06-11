import * as dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";
import { logger } from "@pharos-defi-skills/skills";

const log = logger.child("agent-server");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

const app = createApp();

app.listen(PORT, HOST, () => {
  log.info("Pharos DeFi Skills Agent Server started", {
    host: HOST,
    port: PORT,
    nodeEnv: process.env.NODE_ENV ?? "development",
    authEnabled: !!process.env.AGENT_SERVER_API_KEY,
    supabaseEnabled: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)),
    routes: [
      "GET  /health",
      "GET  /skills",
      "POST /skills/invoke",
      "POST /skills/invoke/batch",
      "POST /skills/:skillName",
    ],
  });
});

export default app;
