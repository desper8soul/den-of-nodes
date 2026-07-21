import { describe, expect, it } from "vitest";
import { mergeDevices } from "../src/devices/merge-devices.js";
import type { StoredDevice } from "@home-dashboard/contracts";

const baseStored: StoredDevice = {
  id: "desktop-pc",
  name: "Ede PC",
  macAddress: "AA:BB:CC:DD:EE:FF",
  lastKnownIpAddress: "192.168.0.100",
  wakeOnLanEnabled: true,
  notes: null,
  createdAt: "2026-07-10T08:00:00.000Z",
  updatedAt: "2026-07-10T08:00:00.000Z",
  lastSeenAt: null,
};

describe("mergeDevices", () => {
  it("keeps configured sleeping device as unknown", () => {
    const merged = mergeDevices({
      storedDevices: [baseStored],
      observedDevices: [],
      activeScanPerformed: false,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("unknown");
    expect(merged[0]?.name).toBe("Ede PC");
    expect(merged[0]?.source).toContain("configured");
  });

  it("marks device online when seen in active scan", () => {
    const merged = mergeDevices({
      storedDevices: [baseStored],
      observedDevices: [
        {
          ip: "192.168.0.100",
          mac: "AA:BB:CC:DD:EE:FF",
          hostname: "edes-pc",
          vendor: null,
          status: "online",
          lastSeenAt: "2026-07-10T09:00:00.000Z",
          source: ["active_scan"],
        },
      ],
      activeScanPerformed: true,
    });

    expect(merged[0]?.status).toBe("online");
    expect(merged[0]?.lastSeenAt).toBe("2026-07-10T09:00:00.000Z");
    expect(merged[0]?.hostname).toBe("edes-pc");
  });

  it("deduplicates by MAC and prefers configured name", () => {
    const merged = mergeDevices({
      storedDevices: [baseStored],
      observedDevices: [
        {
          ip: "192.168.0.100",
          mac: "AA:BB:CC:DD:EE:FF",
          hostname: "other-name",
          vendor: null,
          status: "online",
          lastSeenAt: "2026-07-10T09:00:00.000Z",
          source: ["ip_neigh"],
        },
      ],
      activeScanPerformed: false,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Ede PC");
  });

  it("handles IP change via MAC match", () => {
    const merged = mergeDevices({
      storedDevices: [baseStored],
      observedDevices: [
        {
          ip: "192.168.0.200",
          mac: "AA:BB:CC:DD:EE:FF",
          hostname: null,
          vendor: null,
          status: "online",
          lastSeenAt: "2026-07-10T09:00:00.000Z",
          source: ["proc_arp"],
        },
      ],
      activeScanPerformed: false,
    });

    expect(merged[0]?.ip).toBe("192.168.0.200");
  });

  it("includes discovered but unstored devices", () => {
    const merged = mergeDevices({
      storedDevices: [],
      observedDevices: [
        {
          ip: "192.168.0.50",
          mac: "AA:BB:CC:DD:EE:FF",
          hostname: "printer",
          vendor: null,
          status: "online",
          lastSeenAt: "2026-07-10T09:00:00.000Z",
          source: ["active_scan"],
        },
      ],
      activeScanPerformed: true,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("discovered-AA:BB:CC:DD:EE:FF");
  });
});
