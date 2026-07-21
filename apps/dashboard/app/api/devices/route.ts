import type { NextRequest } from "next/server";
import { getDevices, createDevice, AgentClientError } from "@/lib/agent-client";
import { requireSession } from "@/lib/auth/session";
import { jsonError, validateOrigin } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    await requireSession();
    const data = await getDevices();
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Failed to load devices", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  try {
    await requireSession();
    const body = await request.json();
    const device = await createDevice(body);
    return Response.json(device, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof AgentClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Failed to create device", 400);
  }
}
