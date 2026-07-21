import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { DeviceSource, DeviceStatus } from "@home-dashboard/contracts";
import type { AgentConfig } from "../config.js";
import { logger } from "../logger.js";
import { parseArpScanOutput } from "./arp-scan.js";
import { ipNeighStateToStatus, parseIpNeighOutput } from "./ip-neigh.js";
import { parseProcArpContent } from "./proc-arp.js";
import { resolveHostnames } from "./reverse-dns.js";

const execFileAsync = promisify(execFile);

export interface ObservedNetworkDevice {
  ip: string;
  mac: string | null;
  hostname: string | null;
  vendor: string | null;
  status: DeviceStatus;
  lastSeenAt: string;
  source: DeviceSource[];
}

let lastActiveScanResults: ObservedNetworkDevice[] = [];
let lastActiveScanAt: string | null = null;
let scanInProgress = false;

export function isScanInProgress(): boolean {
  return scanInProgress;
}

async function readIpNeigh(): Promise<ObservedNetworkDevice[]> {
  try {
    const { stdout } = await execFileAsync("ip", ["neigh", "show"]);
    const entries = parseIpNeighOutput(stdout);
    const now = new Date().toISOString();

    return entries.map((entry) => ({
      ip: entry.ip,
      mac: entry.mac,
      hostname: null,
      vendor: null,
      status: ipNeighStateToStatus(entry.state),
      lastSeenAt: now,
      source: ["ip_neigh"] as DeviceSource[],
    }));
  } catch (error) {
    logger.warn("Failed to read ip neigh", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

async function readProcArp(): Promise<ObservedNetworkDevice[]> {
  try {
    const content = await readFile("/proc/net/arp", "utf8");
    const entries = parseProcArpContent(content);
    const now = new Date().toISOString();

    return entries.map((entry) => ({
      ip: entry.ip,
      mac: entry.mac,
      hostname: null,
      vendor: null,
      status: "online" as DeviceStatus,
      lastSeenAt: now,
      source: ["proc_arp"] as DeviceSource[],
    }));
  } catch (error) {
    logger.warn("Failed to read /proc/net/arp", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

function mergeObservedDevices(
  sources: ObservedNetworkDevice[][],
): ObservedNetworkDevice[] {
  const byKey = new Map<string, ObservedNetworkDevice>();

  for (const list of sources) {
    for (const device of list) {
      const key = device.mac ?? device.ip;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, { ...device, source: [...device.source] });
        continue;
      }

      const mergedSources = [...new Set([...existing.source, ...device.source])];
      const statusPriority: Record<DeviceStatus, number> = {
        online: 3,
        unknown: 2,
        offline: 1,
      };

      byKey.set(key, {
        ip: device.ip || existing.ip,
        mac: device.mac ?? existing.mac,
        hostname: device.hostname ?? existing.hostname,
        vendor: device.vendor ?? existing.vendor,
        status:
          statusPriority[device.status]! >= statusPriority[existing.status]!
            ? device.status
            : existing.status,
        lastSeenAt:
          device.lastSeenAt > existing.lastSeenAt
            ? device.lastSeenAt
            : existing.lastSeenAt,
        source: mergedSources,
      });
    }
  }

  return [...byKey.values()];
}

export async function getPassiveNetworkDevices(): Promise<{
  devices: ObservedNetworkDevice[];
  scannedAt: string;
}> {
  const [ipNeigh, procArp] = await Promise.all([
    readIpNeigh(),
    readProcArp(),
  ]);

  const sources: ObservedNetworkDevice[][] = [ipNeigh, procArp];
  if (lastActiveScanResults.length > 0) {
    sources.unshift(lastActiveScanResults);
  }

  const merged = mergeObservedDevices(sources);
  const hostnames = await resolveHostnames(merged.map((d) => d.ip));

  const withHostnames = merged.map((device) => ({
    ...device,
    hostname: hostnames.get(device.ip) ?? device.hostname,
  }));

  return {
    devices: withHostnames,
    scannedAt: new Date().toISOString(),
  };
}

export async function runActiveScan(
  config: AgentConfig,
): Promise<{ devices: ObservedNetworkDevice[]; scannedAt: string }> {
  if (!config.activeScanEnabled) {
    throw new Error("Active scan is disabled");
  }

  if (!(await isArpScanAvailable())) {
    throw new Error(
      "arp-scan is not installed on this host (install it or set ACTIVE_SCAN_ENABLED=false)",
    );
  }

  if (scanInProgress) {
    throw new Error("Active scan already in progress");
  }

  scanInProgress = true;
  const startedAt = Date.now();
  logger.info("Active network scan started", { interface: config.lanInterface });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.activeScanTimeoutMs);

    const { stdout } = await execFileAsync(
      "arp-scan",
      [
        "--localnet",
        `--interface=${config.lanInterface}`,
        "--ignoredups",
        "--quiet",
      ],
      { signal: controller.signal, maxBuffer: 4 * 1024 * 1024 },
    );

    clearTimeout(timeout);

    const parsed = parseArpScanOutput(stdout);
    const now = new Date().toISOString();
    const devices: ObservedNetworkDevice[] = parsed.map((entry) => ({
      ip: entry.ip,
      mac: entry.mac,
      hostname: null,
      vendor: entry.vendor,
      status: "online",
      lastSeenAt: now,
      source: ["active_scan"],
    }));

    const hostnames = await resolveHostnames(devices.map((d) => d.ip));
    lastActiveScanResults = devices.map((device) => ({
      ...device,
      hostname: hostnames.get(device.ip) ?? null,
    }));
    lastActiveScanAt = now;

    logger.info("Active network scan completed", {
      durationMs: Date.now() - startedAt,
      deviceCount: lastActiveScanResults.length,
    });

    return {
      devices: lastActiveScanResults,
      scannedAt: now,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("Active network scan timed out", {
        timeoutMs: config.activeScanTimeoutMs,
      });
      throw new Error("Active scan timed out");
    }

    logger.error("Active network scan failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  } finally {
    scanInProgress = false;
  }
}

export async function isArpScanAvailable(): Promise<boolean> {
  try {
    await execFileAsync("which", ["arp-scan"]);
    return true;
  } catch {
    return false;
  }
}

export function getLastActiveScanAt(): string | null {
  return lastActiveScanAt;
}
