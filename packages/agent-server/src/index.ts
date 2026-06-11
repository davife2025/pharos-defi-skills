import * as dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║       Pharos DeFi Skills — Agent Server v1.0.0          ║
╠══════════════════════════════════════════════════════════╣
║  Listening : http://${HOST}:${PORT}                        
║  Health    : GET  /health                                ║
║  Registry  : GET  /skills                               ║
║  Invoke    : POST /skills/invoke                        ║
║  Batch     : POST /skills/invoke/batch                  ║
║  Shorthand : POST /skills/:skillName                    ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export default app;
