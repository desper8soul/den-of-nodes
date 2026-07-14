import { describe, expect, it, beforeAll } from "vitest";
import { scryptSync } from "node:crypto";

beforeAll(() => {
  process.env.AUTH_USERNAME = "testuser";
  process.env.AUTH_PASSWORD_SALT = "test-salt-value1";
  process.env.AUTH_PASSWORD_HASH = scryptSync(
    "secret",
    "test-salt-value1",
    64,
  ).toString("hex");
  process.env.SESSION_SECRET = "test-session-secret-value-32chars-min";
  process.env.INTERNAL_AGENT_SECRET = "test-internal-agent-secret-32chars";
});

describe("password hashing", () => {
  it("produces deterministic scrypt hash", () => {
    const salt = "test-salt-value1";
    const hash = scryptSync("secret", salt, 64).toString("hex");
    const again = scryptSync("secret", salt, 64).toString("hex");
    expect(hash).toBe(again);
    expect(hash.length).toBeGreaterThan(64);
  });
});

describe("rate limit", () => {
  it("allows requests under limit", async () => {
    const { checkRateLimit } = await import("../lib/rate-limit");
    const first = checkRateLimit("test-key", 3, 60_000);
    const second = checkRateLimit("test-key", 3, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks requests over limit", async () => {
    const { checkRateLimit } = await import("../lib/rate-limit");
    checkRateLimit("block-key", 1, 60_000);
    const blocked = checkRateLimit("block-key", 1, 60_000);
    expect(blocked.allowed).toBe(false);
  });
});

describe("failed login alerts", () => {
  it("sends alert after third failure", async () => {
    const {
      recordFailedLogin,
      shouldSendLoginAlert,
      resetFailedLogin,
    } = await import("../lib/rate-limit");

    recordFailedLogin("1.2.3.4");
    recordFailedLogin("1.2.3.4");
    const third = recordFailedLogin("1.2.3.4");
    expect(shouldSendLoginAlert(third, 15 * 60 * 1000)).toBe(true);
    resetFailedLogin("1.2.3.4");
  });
});
