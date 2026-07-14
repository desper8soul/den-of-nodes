import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { Socket } from "node:dgram";
import {
  buildWakeOnLanPacket,
  sendWakeOnLanPacket,
} from "../src/network/wol.js";

describe("buildWakeOnLanPacket", () => {
  it("creates 102 byte packet", () => {
    const packet = buildWakeOnLanPacket("B0:6E:BF:BB:5A:79");
    expect(packet.length).toBe(102);
  });

  it("starts with 6 ff bytes", () => {
    const packet = buildWakeOnLanPacket("B0:6E:BF:BB:5A:79");
    expect(packet.subarray(0, 6).equals(Buffer.alloc(6, 0xff))).toBe(true);
  });

  it("repeats MAC 16 times", () => {
    const packet = buildWakeOnLanPacket("B0:6E:BF:BB:5A:79");
    const mac = Buffer.from([0xb0, 0x6e, 0xbf, 0xbb, 0x5a, 0x79]);
    for (let i = 0; i < 16; i += 1) {
      expect(packet.subarray(6 + i * 6, 6 + (i + 1) * 6).equals(mac)).toBe(
        true,
      );
    }
  });

  it("rejects invalid MAC", () => {
    expect(() => buildWakeOnLanPacket("invalid")).toThrow();
  });
});

describe("sendWakeOnLanPacket", () => {
  it("uses broadcast address and port", async () => {
    const send = vi.fn(
      (
        _buf: Buffer,
        _port: number,
        _address: string,
        cb: (error: Error | null) => void,
      ) => cb(null),
    );

    const socket = Object.assign(new EventEmitter(), {
      bind: (cb: () => void) => cb(),
      setBroadcast: vi.fn(),
      send,
      close: vi.fn(),
    }) as unknown as Socket;

    await sendWakeOnLanPacket({
      macAddress: "B0:6E:BF:BB:5A:79",
      broadcastAddress: "192.168.0.255",
      port: 9,
      numPackets: 1,
      createSocket: () => socket,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.any(Buffer),
      9,
      "192.168.0.255",
      expect.any(Function),
    );
    expect(socket.close).toHaveBeenCalled();
  });

  it("sends multiple packets with interval", async () => {
    const send = vi.fn(
      (
        _buf: Buffer,
        _port: number,
        _address: string,
        cb: (error: Error | null) => void,
      ) => cb(null),
    );
    const sleep = vi.fn(async () => undefined);

    const socket = Object.assign(new EventEmitter(), {
      bind: (cb: () => void) => cb(),
      setBroadcast: vi.fn(),
      send,
      close: vi.fn(),
    }) as unknown as Socket;

    await sendWakeOnLanPacket({
      macAddress: "B0:6E:BF:BB:5A:79",
      broadcastAddress: "192.168.0.255",
      port: 9,
      numPackets: 3,
      packetIntervalMs: 100,
      sleep,
      createSocket: () => socket,
    });

    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("closes socket on error", async () => {
    const socket = Object.assign(new EventEmitter(), {
      bind: (cb: () => void) => {
        cb();
        socket.emit("error", new Error("send failed"));
      },
      setBroadcast: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
    }) as unknown as Socket;

    await expect(
      sendWakeOnLanPacket({
        macAddress: "B0:6E:BF:BB:5A:79",
        broadcastAddress: "192.168.0.255",
        port: 9,
        timeoutMs: 100,
        createSocket: () => socket,
      }),
    ).rejects.toThrow();

    expect(socket.close).toHaveBeenCalled();
  });
});
