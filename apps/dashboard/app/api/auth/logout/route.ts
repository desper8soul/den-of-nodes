import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { jsonError, validateOrigin } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
