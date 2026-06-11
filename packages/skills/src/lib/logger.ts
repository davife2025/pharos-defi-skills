/**
 * Lightweight structured logger for Pharos DeFi Skills.
 *
 * Outputs JSON lines in production (NODE_ENV=production) for easy
 * ingestion by log aggregators (Datadog, Logtail, etc.).
 * Outputs human-readable coloured lines in development.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";

function resolveLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVELS[env] !== undefined ? env : "info";
}

const MIN_LEVEL = LEVELS[resolveLevel()];
const IS_PROD = process.env.NODE_ENV === "production";

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (LEVELS[level] < MIN_LEVEL) return;

  const ts = new Date().toISOString();

  if (IS_PROD) {
    // JSON line — machine readable
    const line: Record<string, unknown> = {
      ts,
      level,
      msg: message,
      ...context,
    };
    process.stdout.write(JSON.stringify(line) + "\n");
  } else {
    // Human-readable coloured output
    const colour = COLOURS[level];
    const prefix = `${colour}[${level.toUpperCase()}]${RESET}`;
    const ctx = context ? " " + JSON.stringify(context) : "";
    console.log(`${ts} ${prefix} ${message}${ctx}`);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log("info",  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log("warn",  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),

  /**
   * Returns a child logger that prefixes every message with a namespace.
   * Use this inside each skill / module.
   *
   * @example
   * const log = logger.child("portfolio-snapshot");
   * log.info("Fetching balances", { walletAddress });
   */
  child(namespace: string) {
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) =>
        log("debug", `[${namespace}] ${msg}`, ctx),
      info: (msg: string, ctx?: Record<string, unknown>) =>
        log("info",  `[${namespace}] ${msg}`, ctx),
      warn: (msg: string, ctx?: Record<string, unknown>) =>
        log("warn",  `[${namespace}] ${msg}`, ctx),
      error: (msg: string, ctx?: Record<string, unknown>) =>
        log("error", `[${namespace}] ${msg}`, ctx),
    };
  },
};
