import { z } from "zod";

const configSchema = z.object({
  host: z.literal("127.0.0.1"),
  port: z.coerce.number().int().positive().default(3100),
  internalAgentSecret: z.string().min(32),
  devicesFilePath: z.string().default("/data/devices.json"),
  lanInterface: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  lanCidr: z
    .string()
    .regex(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/),
  wolBroadcastAddress: z.string().refine((value) => {
    return (
      z.string().ip({ version: "v4" }).safeParse(value).success ||
      value === "255.255.255.255"
    );
  }),
  wolPort: z.coerce.number().int().positive().default(9),
  wolNumPackets: z.coerce.number().int().positive().default(3),
  wolPacketIntervalMs: z.coerce.number().int().nonnegative().default(100),
  activeScanEnabled: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean()),
  activeScanTimeoutMs: z.coerce.number().int().positive().default(15000),
  securityAlertEmail: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  smtpSecure: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .or(z.boolean()),
  smtpUsername: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpFrom: z.string().email(),
  nodeEnv: z.string().default("production"),
});

export type AgentConfig = z.infer<typeof configSchema>;

export function loadConfig(): AgentConfig {
  const result = configSchema.safeParse({
    host: "127.0.0.1",
    port: process.env.AGENT_PORT ?? 3100,
    internalAgentSecret: process.env.INTERNAL_AGENT_SECRET,
    devicesFilePath: process.env.DEVICES_FILE_PATH ?? "/data/devices.json",
    lanInterface: process.env.LAN_INTERFACE,
    lanCidr: process.env.LAN_CIDR,
    wolBroadcastAddress: process.env.WOL_BROADCAST_ADDRESS,
    wolPort: process.env.WOL_PORT ?? 9,
    wolNumPackets: process.env.WOL_NUM_PACKETS ?? 3,
    wolPacketIntervalMs: process.env.WOL_PACKET_INTERVAL_MS ?? 100,
    activeScanEnabled: process.env.ACTIVE_SCAN_ENABLED ?? "true",
    activeScanTimeoutMs: process.env.ACTIVE_SCAN_TIMEOUT_MS ?? 15000,
    securityAlertEmail: process.env.SECURITY_ALERT_EMAIL,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE ?? "false",
    smtpUsername: process.env.SMTP_USERNAME,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpFrom: process.env.SMTP_FROM,
    nodeEnv: process.env.NODE_ENV ?? "production",
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid network agent configuration: ${details}`);
  }

  return result.data;
}
