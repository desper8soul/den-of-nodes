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

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends iproute2 arp-scan tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /app/apps/network-agent/dist ./dist
COPY --from=builder /app/apps/network-agent/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/dist ./node_modules/@home-dashboard/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./node_modules/@home-dashboard/contracts/package.json
USER app
EXPOSE 3100
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/internal/health',{headers:{authorization:'Bearer '+process.env.INTERNAL_AGENT_SECRET}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
