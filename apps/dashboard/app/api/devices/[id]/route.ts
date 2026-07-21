import type { NextRequest } from "next/server";
import { updateDevice, deleteDevice } from "@/lib/agent-client";
import { requireSession } from "@/lib/auth/session";
import { jsonError, validateOrigin } from "@/lib/api-utils";
import { AgentClientError } from "@/lib/agent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  try {
    await requireSession();
    const { id } = await context.params;
    const body = await request.json();
    const device = await updateDevice(id, body);
    return Response.json(device);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof AgentClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Failed to update device", 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  try {
    await requireSession();
    const { id } = await context.params;
    await deleteDevice(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof AgentClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Failed to delete device", 400);
  }
}
