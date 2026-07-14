import nodemailer from "nodemailer";
import type { LoginAlertRequest } from "@home-dashboard/contracts";
import type { AgentConfig } from "../config.js";
import { logger } from "../logger.js";

function formatReadableTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(iso));
}

function shortenUserAgent(userAgent: string): string {
  return userAgent.length > 120 ? `${userAgent.slice(0, 117)}...` : userAgent;
}

export async function sendLoginAlertEmail(
  config: AgentConfig,
  alert: LoginAlertRequest,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword,
    },
  });

  const subject = "[Home Dashboard] Failed login attempts";
  const text = [
    "Event: Failed login attempts",
    `Timestamp (UTC): ${alert.occurredAt}`,
    `Timestamp (readable): ${formatReadableTime(alert.occurredAt)}`,
    `Source IP: ${alert.sourceIp}`,
    `User-Agent: ${shortenUserAgent(alert.userAgent)}`,
    `Attempt count: ${alert.failureCount}`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: config.smtpFrom,
      to: config.securityAlertEmail,
      subject,
      text,
    });
    logger.info("Security alert email sent", {
      sourceIp: alert.sourceIp,
      failureCount: alert.failureCount,
    });
  } catch (error) {
    logger.error("Failed to send security alert email", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
