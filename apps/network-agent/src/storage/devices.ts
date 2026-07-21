import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createDeviceRequestSchema,
  devicesFileSchema,
  normalizeMacAddress,
  type CreateDeviceRequest,
  type DevicesFile,
  type StoredDevice,
  type UpdateDeviceRequest,
  updateDeviceRequestSchema,
} from "@home-dashboard/contracts";
import { logger } from "../logger.js";

export class DeviceStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceStorageError";
  }
}

export class DeviceStorage {
  private readonly filePath: string;
  private mutex: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        const initial: DevicesFile = { version: 1, devices: [] };
        await this.writeFileAtomic(initial);
        logger.info("Created empty devices file", { path: this.filePath });
        return;
      }
      throw error;
    }

    await this.readValidated();
  }

  async list(): Promise<StoredDevice[]> {
    const file = await this.readValidated();
    return file.devices;
  }

  async create(input: CreateDeviceRequest): Promise<StoredDevice> {
    const parsed = createDeviceRequestSchema.parse(input);
    return this.withLock(async () => {
      const file = await this.readValidated();
      const mac = normalizeMacAddress(parsed.macAddress);

      if (file.devices.some((device) => device.macAddress === mac)) {
        throw new DeviceStorageError("Device with this MAC already exists");
      }

      const now = new Date().toISOString();
      const device: StoredDevice = {
        id: randomUUID(),
        name: parsed.name,
        macAddress: mac,
        lastKnownIpAddress: parsed.lastKnownIpAddress ?? null,
        wakeOnLanEnabled: parsed.wakeOnLanEnabled ?? false,
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: null,
      };

      file.devices.push(device);
      await this.writeFileAtomic(file);
      return device;
    });
  }

  async update(id: string, input: UpdateDeviceRequest): Promise<StoredDevice> {
    const parsed = updateDeviceRequestSchema.parse(input);
    return this.withLock(async () => {
      const file = await this.readValidated();
      const index = file.devices.findIndex((device) => device.id === id);
      if (index === -1) {
        throw new DeviceStorageError("Device not found");
      }

      const current = file.devices[index]!;
      const nextMac = parsed.macAddress
        ? normalizeMacAddress(parsed.macAddress)
        : current.macAddress;

      if (
        nextMac !== current.macAddress &&
        file.devices.some(
          (device) => device.macAddress === nextMac && device.id !== id,
        )
      ) {
        throw new DeviceStorageError("Device with this MAC already exists");
      }

      const updated: StoredDevice = {
        ...current,
        ...parsed,
        macAddress: nextMac,
        updatedAt: new Date().toISOString(),
      };

      file.devices[index] = updated;
      await this.writeFileAtomic(file);
      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    await this.withLock(async () => {
      const file = await this.readValidated();
      const nextDevices = file.devices.filter((device) => device.id !== id);
      if (nextDevices.length === file.devices.length) {
        throw new DeviceStorageError("Device not found");
      }
      file.devices = nextDevices;
      await this.writeFileAtomic(file);
    });
  }

  async getById(id: string): Promise<StoredDevice | null> {
    const file = await this.readValidated();
    return file.devices.find((device) => device.id === id) ?? null;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.mutex;
    this.mutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async readValidated(): Promise<DevicesFile> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      logger.error("Failed to read devices file", {
        path: this.filePath,
        error: error instanceof Error ? error.message : "unknown",
      });
      throw new DeviceStorageError("Devices file is unreadable");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.error("Devices file contains invalid JSON", {
        path: this.filePath,
      });
      throw new DeviceStorageError("Devices file contains invalid JSON");
    }

    const result = devicesFileSchema.safeParse(parsed);
    if (!result.success) {
      logger.error("Devices file failed validation", {
        path: this.filePath,
      });
      throw new DeviceStorageError("Devices file failed validation");
    }

    return result.data;
  }

  private async writeFileAtomic(file: DevicesFile): Promise<void> {
    const validated = devicesFileSchema.parse(file);
    const dir = path.dirname(this.filePath);
    const tempPath = path.join(
      dir,
      `.devices.${randomUUID()}.tmp`,
    );
    const payload = `${JSON.stringify(validated, null, 2)}\n`;

    await writeFile(tempPath, payload, "utf8");
    const handle = await open(tempPath, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tempPath, this.filePath);
  }
}
