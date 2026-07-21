import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { createAuthHook } from "./auth.js";
import { logger } from "./logger.js";
import { isArpScanAvailable } from "./network/collector.js";
import { registerRoutes } from "./routes.js";
import { DeviceStorage } from "./storage/devices.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.activeScanEnabled && !(await isArpScanAvailable())) {
    logger.warn(
      "arp-scan is not installed; the agent will start but active network scan will fail until it is available",
    );
  }

  const storage = new DeviceStorage(config.devicesFilePath);
  await storage.initialize();

  const app = Fastify({
    logger: false,
    requestTimeout: 30_000,
  });

  const authHook = createAuthHook(config);

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/internal/health") {
      return;
    }
    await authHook(request, reply);
  });

  await registerRoutes(app, { config, storage });

  await app.listen({ host: config.host, port: config.port });
  logger.info("Network agent started", {
    host: config.host,
    port: config.port,
  });
}

main().catch((error) => {
  logger.error("Network agent failed to start", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
