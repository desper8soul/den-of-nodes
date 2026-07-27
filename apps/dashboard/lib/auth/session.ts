import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDashboardConfig } from "../config";

const SESSION_COOKIE = "dashboard_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionPayload {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

function signPayload(payload: SessionPayload): string {
  const config = getDashboardConfig();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function parseSignedSession(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const config = getDashboardConfig();
  const expected = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");

  const provided = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (
    provided.length !== expectedBuf.length ||
    !timingSafeEqual(provided, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function createSessionCookie(): Promise<void> {
  const config = getDashboardConfig();
  const now = Date.now();
  const payload: SessionPayload = {
    sessionId: randomBytes(16).toString("hex"),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signPayload(payload), {
    httpOnly: true,
    sameSite: "strict",
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }
  return parseSignedSession(value);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export { SESSION_COOKIE };
