import type { NextRequest } from "next/server";
import { scanNetwork, AgentClientError } from "@/lib/agent-client";
import { requireSession } from "@/lib/auth/session";
import { jsonError, validateOrigin } from "@/lib/api-utils";
import { getDashboardConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  const config = getDashboardConfig();
  if (!config.activeScanEnabled) {
    return jsonError("Active scan is disabled", 400);
  }

  try {
    await requireSession();
    const data = await scanNetwork();
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof AgentClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Active scan failed", 500);
  }
}
