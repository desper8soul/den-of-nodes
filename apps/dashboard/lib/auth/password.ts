import { scryptSync, timingSafeEqual } from "node:crypto";
import { getDashboardConfig } from "../config";

export function verifyPassword(password: string): boolean {
  const config = getDashboardConfig();
  const derived = scryptSync(
    password,
    config.authPasswordSalt,
    64,
  ).toString("hex");

  const provided = Buffer.from(derived, "utf8");
  const expected = Buffer.from(config.authPasswordHash, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function verifyUsername(username: string): boolean {
  const config = getDashboardConfig();
  const provided = Buffer.from(username, "utf8");
  const expected = Buffer.from(config.authUsername, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function verifyCredentials(
  username: string,
  password: string,
): boolean {
  return verifyUsername(username) && verifyPassword(password);
}
