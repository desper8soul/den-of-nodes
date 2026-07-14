import type { FastifyInstance } from "fastify";
import {
  createDeviceRequestSchema,
  loginAlertRequestSchema,
  redactMacAddress,
  updateDeviceRequestSchema,
} from "@home-dashboard/contracts";
import type { AgentConfig } from "./config.js";
import { mergeDevices } from "./devices/merge-devices.js";
import { logger } from "./logger.js";
import {
  getLastActiveScanAt,
  getPassiveNetworkDevices,
  runActiveScan,
} from "./network/collector.js";
import { sendWakeOnLanPacket } from "./network/wol.js";
import { DeviceStorage, DeviceStorageError } from "./storage/devices.js";
import { sendLoginAlertEmail } from "./email/alert.js";

interface RouteDeps {
  config: AgentConfig;
  storage: DeviceStorage;
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  const { config, storage } = deps;

  app.get("/internal/health", async () => ({ status: "ok" as const }));

  app.get("/internal/devices", async (_request, reply) => {
    try {
      const storedDevices = await storage.list();
      const passive = await getPassiveNetworkDevices();
      const activeScanPerformed = getLastActiveScanAt() !== null;

      const devices = mergeDevices({
        storedDevices,
        observedDevices: passive.devices,
        activeScanPerformed,
      });

      return reply.send({
        devices,
        scannedAt: passive.scannedAt,
        activeScanPerformed,
      });
    } catch (error) {
      if (error instanceof DeviceStorageError) {
        return reply.code(503).send({ error: "Device storage unavailable" });
      }
      logger.error("Failed to list devices", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.post("/internal/devices", async (request, reply) => {
    const parsed = createDeviceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const device = await storage.create(parsed.data);
      return reply.code(201).send(device);
    } catch (error: unknown) {
      if (error instanceof DeviceStorageError) {
        return reply.code(400).send({ error: error.message });
      }
      logger.error("Failed to create device", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.patch("/internal/devices/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateDeviceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    try {
      const device = await storage.update(id, parsed.data);
      return reply.send(device);
    } catch (error: unknown) {
      if (error instanceof DeviceStorageError) {
        const status = error.message === "Device not found" ? 404 : 400;
        return reply.code(status).send({ error: error.message });
      }
      logger.error("Failed to update device", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.delete("/internal/devices/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await storage.delete(id);
      return reply.code(204).send();
    } catch (error: unknown) {
      if (error instanceof DeviceStorageError) {
        return reply.code(404).send({ error: error.message });
      }
      logger.error("Failed to delete device", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.post("/internal/devices/:id/wake", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const device = await storage.getById(id);
      if (!device) {
        return reply.code(404).send({ error: "Device not found" });
      }

      if (!device.wakeOnLanEnabled) {
        return reply
          .code(400)
          .send({ error: "Wake-on-LAN is not enabled for this device" });
      }

      await sendWakeOnLanPacket({
        macAddress: device.macAddress,
        broadcastAddress: config.wolBroadcastAddress,
        port: config.wolPort,
        numPackets: config.wolNumPackets,
        packetIntervalMs: config.wolPacketIntervalMs,
      });

      logger.info("Wake-on-LAN packet sent", {
        deviceId: device.id,
        targetIp: device.lastKnownIpAddress,
        mac: redactMacAddress(device.macAddress),
        success: true,
      });

      return reply.send({
        success: true,
        message: "Wake-on-LAN magic packet sent.",
      });
    } catch (error) {
      logger.error("Wake-on-LAN packet failed", {
        deviceId: id,
        error: error instanceof Error ? error.message : "unknown",
        success: false,
      });
      return reply.code(500).send({ error: "Failed to send magic packet" });
    }
  });

  app.get("/internal/network/devices", async (_request, reply) => {
    try {
      const passive = await getPassiveNetworkDevices();
      return reply.send(passive);
    } catch (error) {
      logger.error("Failed to get network devices", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  app.post("/internal/network/scan", async (_request, reply) => {
    if (!config.activeScanEnabled) {
      return reply.code(400).send({ error: "Active scan is disabled" });
    }

    try {
      const result = await runActiveScan(config);
      return reply.send({
        devices: result.devices,
        scannedAt: result.scannedAt,
        activeScanPerformed: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Active scan failed";
      const status = message.includes("already in progress") ? 409 : 500;
      return reply.code(status).send({ error: message });
    }
  });

  app.post("/internal/security/login-alert", async (request, reply) => {
    const parsed = loginAlertRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    await sendLoginAlertEmail(config, parsed.data);
    return reply.send({ success: true });
  });
}
