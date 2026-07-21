FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY packages/contracts ./packages/contracts
COPY apps/dashboard ./apps/dashboard
RUN pnpm --filter @home-dashboard/contracts build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @home-dashboard/dashboard build

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=app:app /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=app:app /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER app
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/dashboard/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
