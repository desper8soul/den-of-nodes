type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(payload: LogPayload): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export const logger = {
  info(message: string, meta: Record<string, unknown> = {}): void {
    write({ level: "info", message, timestamp: new Date().toISOString(), ...meta });
  },
  warn(message: string, meta: Record<string, unknown> = {}): void {
    write({ level: "warn", message, timestamp: new Date().toISOString(), ...meta });
  },
  error(message: string, meta: Record<string, unknown> = {}): void {
    write({ level: "error", message, timestamp: new Date().toISOString(), ...meta });
  },
  debug(message: string, meta: Record<string, unknown> = {}): void {
    if (process.env.NODE_ENV !== "production") {
      write({ level: "debug", message, timestamp: new Date().toISOString(), ...meta });
    }
  },
};
