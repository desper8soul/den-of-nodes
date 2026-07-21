import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { sendLoginAlert } from "@/lib/agent-client";
import {
  getClientIp,
  jsonError,
  validateOrigin,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  markLoginAlertSent,
  recordFailedLogin,
  resetFailedLogin,
  shouldSendLoginAlert,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return jsonError("Forbidden", 403);
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(`login:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return jsonError("Too many requests", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid credentials", 401);
  }

  const valid = verifyCredentials(
    parsed.data.username,
    parsed.data.password,
  );

  if (!valid) {
    const state = recordFailedLogin(ip);
    logger.warn("Login failed", { sourceIp: ip });

    if (shouldSendLoginAlert(state, ALERT_COOLDOWN_MS)) {
      markLoginAlertSent(ip);
      void sendLoginAlert({
        sourceIp: ip,
        userAgent: request.headers.get("user-agent") ?? "unknown",
        failureCount: state.consecutiveFailures,
        occurredAt: new Date().toISOString(),
      }).catch(() => {
        // logged in agent-client
      });
    }

    return jsonError("Invalid credentials", 401);
  }

  resetFailedLogin(ip);
  await createSessionCookie();
  return NextResponse.json({ success: true });
}
