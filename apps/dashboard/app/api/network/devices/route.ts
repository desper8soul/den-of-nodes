import type { NextRequest } from "next/server";
import { getNetworkDevices } from "@/lib/agent-client";
import { requireSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    await requireSession();
    const data = await getNetworkDevices();
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Failed to load network devices", 503);
  }
}
