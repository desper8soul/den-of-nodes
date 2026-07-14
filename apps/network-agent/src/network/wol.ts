import { createSocket, type Socket } from "node:dgram";
import {
  isValidMacAddress,
  normalizeMacAddress,
} from "@home-dashboard/contracts";

export interface WakeOnLanOptions {
  macAddress: string;
  broadcastAddress: string;
  port: number;
  numPackets?: number;
  packetIntervalMs?: number;
  timeoutMs?: number;
  createSocket?: () => Socket;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_NUM_PACKETS = 3;
const DEFAULT_PACKET_INTERVAL_MS = 100;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sendPacketOnSocket(
  socket: Socket,
  packet: Buffer,
  port: number,
  broadcastAddress: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.send(packet, port, broadcastAddress, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function buildWakeOnLanPacket(macAddress: string): Buffer {
  const normalized = normalizeMacAddress(macAddress);
  if (!isValidMacAddress(normalized)) {
    throw new Error("Invalid MAC address");
  }

  const macBytes = Buffer.from(
    normalized.split(":").map((part: string) => parseInt(part, 16)),
  );

  const packet = Buffer.alloc(102);
  packet.fill(0xff, 0, 6);

  for (let i = 0; i < 16; i += 1) {
    macBytes.copy(packet, 6 + i * 6);
  }

  return packet;
}

export async function sendWakeOnLanPacket(
  options: WakeOnLanOptions,
): Promise<void> {
  const normalized = normalizeMacAddress(options.macAddress);
  if (!isValidMacAddress(normalized)) {
    throw new Error("Invalid MAC address");
  }

  const numPackets = options.numPackets ?? DEFAULT_NUM_PACKETS;
  const packetIntervalMs = options.packetIntervalMs ?? DEFAULT_PACKET_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const packet = buildWakeOnLanPacket(normalized);
  const socket = options.createSocket?.() ?? createSocket("udp4");
  const timeoutMs = options.timeoutMs ?? 5000;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Wake-on-LAN send timeout"));
    }, timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });

    socket.bind(() => {
      void (async () => {
        try {
          socket.setBroadcast(true);

          for (let i = 0; i < numPackets; i += 1) {
            await sendPacketOnSocket(
              socket,
              packet,
              options.port,
              options.broadcastAddress,
            );

            if (i < numPackets - 1) {
              await sleep(packetIntervalMs);
            }
          }

          clearTimeout(timer);
          socket.close();
          resolve();
        } catch (error) {
          clearTimeout(timer);
          socket.close();
          reject(error);
        }
      })();
    });
  });
}
