import type {
  DeviceSource,
  DeviceStatus,
  MergedDevice,
  StoredDevice,
} from "@home-dashboard/contracts";
import type { ObservedNetworkDevice } from "../network/collector.js";

interface MergeOptions {
  storedDevices: StoredDevice[];
  observedDevices: ObservedNetworkDevice[];
  activeScanPerformed: boolean;
}

export function mergeDevices(options: MergeOptions): MergedDevice[] {
  const { storedDevices, observedDevices, activeScanPerformed } = options;
  const observedByMac = new Map<string, ObservedNetworkDevice>();
  const observedByIp = new Map<string, ObservedNetworkDevice>();

  for (const observed of observedDevices) {
    if (observed.mac) {
      observedByMac.set(observed.mac, observed);
    }
    observedByIp.set(observed.ip, observed);
  }

  const merged: MergedDevice[] = [];
  const seenMacs = new Set<string>();

  for (const stored of storedDevices) {
    seenMacs.add(stored.macAddress);
    const byMac = observedByMac.get(stored.macAddress);
    const byIp = stored.lastKnownIpAddress
      ? observedByIp.get(stored.lastKnownIpAddress)
      : undefined;
    const observed = byMac ?? byIp;

    let status: DeviceStatus = "unknown";
    const sources: DeviceSource[] = ["configured"];
    let lastSeenAt: string | null = stored.lastSeenAt;
    let ip = stored.lastKnownIpAddress;
    let hostname: string | null = null;
    let vendor: string | null = null;

    if (observed) {
      status = observed.status;
      sources.push(...observed.source);
      lastSeenAt = observed.lastSeenAt;
      ip = observed.ip;
      hostname = observed.hostname;
      vendor = observed.vendor;
    } else if (activeScanPerformed) {
      status = "unknown";
    }

    merged.push({
      id: stored.id,
      name: stored.name,
      ip,
      mac: stored.macAddress,
      hostname,
      vendor,
      status,
      lastSeenAt,
      wakeOnLanEnabled: stored.wakeOnLanEnabled,
      notes: stored.notes,
      source: [...new Set(sources)],
    });
  }

  for (const observed of observedDevices) {
    if (!observed.mac || seenMacs.has(observed.mac)) {
      continue;
    }

    merged.push({
      id: `discovered-${observed.mac}`,
      name: observed.hostname ?? observed.ip,
      ip: observed.ip,
      mac: observed.mac,
      hostname: observed.hostname,
      vendor: observed.vendor,
      status: observed.status,
      lastSeenAt: observed.lastSeenAt,
      wakeOnLanEnabled: false,
      notes: null,
      source: [...new Set(observed.source)],
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

export function updateLastSeenFromObservation(
  stored: StoredDevice,
  observed: ObservedNetworkDevice | undefined,
): StoredDevice {
  if (!observed) {
    return stored;
  }

  return {
    ...stored,
    lastKnownIpAddress: observed.ip,
    lastSeenAt: observed.lastSeenAt,
    updatedAt: new Date().toISOString(),
  };
}
