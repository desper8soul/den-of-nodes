FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/network-agent/package.json ./apps/network-agent/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/contracts ./packages/contracts
COPY apps/network-agent ./apps/network-agent
RUN pnpm --filter @home-dashboard/contracts build
RUN pnpm --filter @home-dashboard/network-agent build

# Keep the pnpm workspace layout so package symlinks (e.g. fastify -> .pnpm/...) resolve.
FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends iproute2 arp-scan tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder --chown=app:app /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/packages/contracts ./packages/contracts
COPY --from=builder --chown=app:app /app/apps/network-agent ./apps/network-agent
COPY apps/network-agent/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
# Start as root so the entrypoint can chown the /data volume, then drop to `app`.
WORKDIR /app/apps/network-agent
EXPOSE 3100
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/internal/health',{headers:{authorization:'Bearer '+process.env.INTERNAL_AGENT_SECRET}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
