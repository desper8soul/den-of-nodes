import type { NextRequest } from "next/server";
import { wakeDevice, AgentClientError } from "@/lib/agent-client";
import { requireSession } from "@/lib/auth/session";
import { jsonError, validateOrigin } from "@/lib/api-utils";
import { checkRateLimit, checkWakeCooldown } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const session = await requireSession();
    const { id } = await context.params;

    const sessionRate = checkRateLimit(
      `wake:${session.sessionId}`,
      3,
      60_000,
    );
    if (!sessionRate.allowed) {
      return jsonError("Too many wake requests", 429);
    }

    if (!checkWakeCooldown(session.sessionId, id, 5000)) {
      return jsonError("Please wait before sending another wake packet", 429);
    }

    const result = await wakeDevice(id);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof AgentClientError) {
      return jsonError(error.message, error.status);
    }
    logger.error("Wake request failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonError("Failed to send wake packet", 500);
  }
}
