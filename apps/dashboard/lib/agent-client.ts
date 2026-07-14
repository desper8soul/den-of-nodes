import {
  createDeviceRequestSchema,
  devicesResponseSchema,
  healthResponseSchema,
  loginAlertRequestSchema,
  networkDevicesResponseSchema,
  updateDeviceRequestSchema,
  wakeResponseSchema,
  type CreateDeviceRequest,
  type DevicesResponse,
  type LoginAlertRequest,
  type NetworkDevicesResponse,
  type UpdateDeviceRequest,
  type WakeResponse,
} from "@home-dashboard/contracts";
import { getDashboardConfig } from "./config";
import { logger } from "./logger";

export class AgentClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentClientError";
    this.status = status;
  }
}

async function agentFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getDashboardConfig();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.agentRequestTimeoutMs,
  );

  const hasJsonBody = init?.body !== undefined && init?.body !== null;

  try {
    const response = await fetch(`${config.networkAgentUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.internalAgentSecret}`,
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let message = "Agent request failed";
      try {
        const body = (await response.json()) as {
          error?: string;
          message?: string;
        };
        message = body.error ?? body.message ?? message;
      } catch {
        // ignore
      }
      throw new AgentClientError(message, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AgentClientError) {
      throw error;
    }
    logger.error("Network agent request failed", {
      path,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new AgentClientError("Network agent unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAgentHealth(): Promise<{ status: "ok" }> {
  const data = await agentFetch<{ status: "ok" }>("/internal/health");
  return healthResponseSchema.parse(data);
}

export async function getDevices(): Promise<DevicesResponse> {
  const data = await agentFetch<DevicesResponse>("/internal/devices");
  return devicesResponseSchema.parse(data);
}

export async function getNetworkDevices(): Promise<NetworkDevicesResponse> {
  const data = await agentFetch<NetworkDevicesResponse>(
    "/internal/network/devices",
  );
  return networkDevicesResponseSchema.parse(data);
}

export async function scanNetwork(): Promise<NetworkDevicesResponse> {
  const data = await agentFetch<NetworkDevicesResponse>(
    "/internal/network/scan",
    { method: "POST" },
  );
  return networkDevicesResponseSchema.parse(data);
}

export async function createDevice(input: CreateDeviceRequest) {
  const body = createDeviceRequestSchema.parse(input);
  return agentFetch("/internal/devices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateDevice(id: string, input: UpdateDeviceRequest) {
  const body = updateDeviceRequestSchema.parse(input);
  return agentFetch(`/internal/devices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteDevice(id: string): Promise<void> {
  await agentFetch(`/internal/devices/${id}`, { method: "DELETE" });
}

export async function wakeDevice(id: string): Promise<WakeResponse> {
  const data = await agentFetch<WakeResponse>(`/internal/devices/${id}/wake`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return wakeResponseSchema.parse(data);
}

export async function sendLoginAlert(input: LoginAlertRequest): Promise<void> {
  const body = loginAlertRequestSchema.parse(input);
  await agentFetch("/internal/security/login-alert", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
