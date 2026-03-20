import { inspect } from "node:util";

type LogLevel = "INFO" | "WARN" | "ERROR";

export function logInfo(message: string, details?: unknown): void {
  writeLog("INFO", message, details);
}

export function logWarn(message: string, details?: unknown): void {
  writeLog("WARN", message, details);
}

export function logError(message: string, details?: unknown): void {
  writeLog("ERROR", message, details);
}

function writeLog(level: LogLevel, message: string, details?: unknown): void {
  const suffix = details === undefined
    ? ""
    : ` ${inspect(details, { depth: 6, colors: false, breakLength: Infinity })}`;

  process.stderr.write(`[dom-mcp] ${level} ${message}${suffix}\n`);
}
