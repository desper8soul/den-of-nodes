import { describe, expect, it } from "vitest";
import { parseArpScanOutput } from "../src/network/arp-scan.js";
import {
  ipNeighStateToStatus,
  parseIpNeighOutput,
} from "../src/network/ip-neigh.js";
import { parseProcArpContent } from "../src/network/proc-arp.js";

describe("parseIpNeighOutput", () => {
  it("parses typical Linux output", () => {
    const output = `192.168.0.100 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
192.168.0.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff STALE
192.168.0.50 dev eth0 FAILED`;

    const entries = parseIpNeighOutput(output);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      ip: "192.168.0.100",
      mac: "AA:BB:CC:DD:EE:FF",
      state: "REACHABLE",
    });
  });

  it("ignores invalid lines", () => {
    expect(parseIpNeighOutput("garbage line\n")).toHaveLength(0);
  });
});

describe("ipNeighStateToStatus", () => {
  it("maps states conservatively", () => {
    expect(ipNeighStateToStatus("REACHABLE")).toBe("online");
    expect(ipNeighStateToStatus("FAILED")).toBe("offline");
    expect(ipNeighStateToStatus("WEIRD")).toBe("unknown");
  });
});

describe("parseProcArpContent", () => {
  it("parses /proc/net/arp content", () => {
    const content = `IP address       HW type     Flags       HW address            Mask     Device
192.168.0.100    0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0
192.168.0.1      0x1         0x2         00:00:00:00:00:00     *        eth0`;

    const entries = parseProcArpContent(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.mac).toBe("AA:BB:CC:DD:EE:FF");
  });
});

describe("parseArpScanOutput", () => {
  it("parses arp-scan output", () => {
    const output = `Interface: eth0, type: EN10MB, MAC: dc:a6:32:xx:xx:xx, IPv4: 192.168.0.10
Starting arp-scan 1.10.0 with 256 hosts
192.168.0.100\taa:bb:cc:dd:ee:ff\tIntel Corporate
192.168.0.1\taa:bb:cc:dd:ee:ff\tRouter Vendor`;

    const entries = parseArpScanOutput(output);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      ip: "192.168.0.100",
      mac: "AA:BB:CC:DD:EE:FF",
      vendor: "Intel Corporate",
    });
  });
});
