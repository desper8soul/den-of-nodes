import { z } from "zod";

/** MAC address in uppercase colon-separated format, e.g. AA:BB:CC:DD:EE:FF */
export const macAddressSchema = z
  .string()
  .transform((value) => normalizeMacAddress(value))
  .refine((value) => isValidMacAddress(value), {
    message: "Invalid MAC address",
  });

export const ipAddressSchema = z
  .string()
  .refine((value) => isValidIpAddress(value), {
    message: "Invalid IP address",
  });

export const deviceStatusSchema = z.enum(["online", "offline", "unknown"]);

export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export const deviceSourceSchema = z.enum([
  "configured",
  "active_scan",
  "ip_neigh",
  "proc_arp",
  "cache",
]);

export type DeviceSource = z.infer<typeof deviceSourceSchema>;

export const storedDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  macAddress: macAddressSchema,
  lastKnownIpAddress: ipAddressSchema.nullable(),
  wakeOnLanEnabled: z.boolean().default(false),
  notes: z.string().max(512).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
});

export type StoredDevice = z.infer<typeof storedDeviceSchema>;

export const devicesFileSchema = z.object({
  version: z.literal(1),
  devices: z.array(storedDeviceSchema),
});

export type DevicesFile = z.infer<typeof devicesFileSchema>;

export const createDeviceRequestSchema = z.object({
  name: z.string().min(1).max(128),
  macAddress: macAddressSchema,
  lastKnownIpAddress: ipAddressSchema.nullable().optional(),
  wakeOnLanEnabled: z.boolean().optional().default(false),
  notes: z.string().max(512).nullable().optional(),
});

export type CreateDeviceRequest = z.infer<typeof createDeviceRequestSchema>;

export const updateDeviceRequestSchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    macAddress: macAddressSchema.optional(),
    lastKnownIpAddress: ipAddressSchema.nullable().optional(),
    wakeOnLanEnabled: z.boolean().optional(),
    notes: z.string().max(512).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateDeviceRequest = z.infer<typeof updateDeviceRequestSchema>;

export const mergedDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  ip: ipAddressSchema.nullable(),
  mac: macAddressSchema,
  hostname: z.string().nullable(),
  vendor: z.string().nullable(),
  status: deviceStatusSchema,
  lastSeenAt: z.string().datetime().nullable(),
  wakeOnLanEnabled: z.boolean(),
  notes: z.string().nullable(),
  source: z.array(deviceSourceSchema),
});

export type MergedDevice = z.infer<typeof mergedDeviceSchema>;

export const devicesResponseSchema = z.object({
  devices: z.array(mergedDeviceSchema),
  scannedAt: z.string().datetime(),
  activeScanPerformed: z.boolean(),
});

export type DevicesResponse = z.infer<typeof devicesResponseSchema>;

export const networkDeviceSchema = z.object({
  ip: ipAddressSchema,
  mac: macAddressSchema.nullable(),
  hostname: z.string().nullable(),
  vendor: z.string().nullable(),
  status: deviceStatusSchema,
  lastSeenAt: z.string().datetime().nullable(),
  source: z.array(deviceSourceSchema),
});

export type NetworkDevice = z.infer<typeof networkDeviceSchema>;

export const networkDevicesResponseSchema = z.object({
  devices: z.array(networkDeviceSchema),
  scannedAt: z.string().datetime(),
});

export type NetworkDevicesResponse = z.infer<
  typeof networkDevicesResponseSchema
>;

export const wakeResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type WakeResponse = z.infer<typeof wakeResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const loginAlertRequestSchema = z.object({
  sourceIp: z.string().min(1),
  userAgent: z.string().max(512),
  failureCount: z.number().int().positive(),
  occurredAt: z.string().datetime(),
});

export type LoginAlertRequest = z.infer<typeof loginAlertRequestSchema>;

export function normalizeMacAddress(input: string): string {
  const cleaned = input.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (cleaned.length !== 12) {
    return input.toUpperCase();
  }
  return cleaned.match(/.{1,2}/g)!.join(":");
}

export function isValidMacAddress(mac: string): boolean {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}

export function isValidIpAddress(ip: string): boolean {
  if (z.string().ip({ version: "v4" }).safeParse(ip).success) {
    return true;
  }
  return z.string().ip({ version: "v6" }).safeParse(ip).success;
}

export function redactMacAddress(mac: string): string {
  const parts = mac.split(":");
  if (parts.length !== 6) {
    return "**:**:**:**:**:**";
  }
  return `${parts[0]}:${parts[1]}:${parts[2]}:**:**:${parts[5]}`;
}
