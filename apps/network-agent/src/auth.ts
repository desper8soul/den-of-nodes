import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AgentConfig } from "./config.js";

export function createAuthHook(config: AgentConfig) {
  const expected = Buffer.from(`Bearer ${config.internalAgentSecret}`, "utf8");

  return async function authHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const header = request.headers.authorization;
    if (!header) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }

    const provided = Buffer.from(header, "utf8");
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }
  };
}
