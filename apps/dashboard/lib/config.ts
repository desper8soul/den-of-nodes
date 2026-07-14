import { z } from "zod";

const configSchema = z.object({
  authUsername: z.string().min(1),
  authPasswordSalt: z.string().min(16),
  authPasswordHash: z.string().min(64),
  sessionSecret: z.string().min(32),
  networkAgentUrl: z.string().url().default("http://127.0.0.1:3100"),
  internalAgentSecret: z.string().min(32),
  activeScanEnabled: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(true),
  nodeEnv: z.string().default("production"),
  agentRequestTimeoutMs: z.coerce.number().int().positive().default(15000),
});

export type DashboardConfig = z.infer<typeof configSchema>;

export function loadDashboardConfig(): DashboardConfig {
  const result = configSchema.safeParse({
    authUsername: process.env.AUTH_USERNAME,
    authPasswordSalt: process.env.AUTH_PASSWORD_SALT,
    authPasswordHash: process.env.AUTH_PASSWORD_HASH,
    sessionSecret: process.env.SESSION_SECRET,
    networkAgentUrl: process.env.NETWORK_AGENT_URL ?? "http://127.0.0.1:3100",
    internalAgentSecret: process.env.INTERNAL_AGENT_SECRET,
    activeScanEnabled: process.env.ACTIVE_SCAN_ENABLED ?? "true",
    nodeEnv: process.env.NODE_ENV ?? "production",
    agentRequestTimeoutMs: process.env.AGENT_REQUEST_TIMEOUT_MS ?? 15000,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid dashboard configuration: ${details}`);
  }

  return result.data;
}

let cachedConfig: DashboardConfig | null = null;

export function getDashboardConfig(): DashboardConfig {
  if (!cachedConfig) {
    cachedConfig = loadDashboardConfig();
  }
  return cachedConfig;
}
