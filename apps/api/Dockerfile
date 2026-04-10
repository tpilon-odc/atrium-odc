# ── Stage 1: deps ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspace=apps/api --include-workspace-root

# ── Stage 2: build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npx tsc --project packages/shared/tsconfig.json
RUN npm run build --workspace=apps/api

# ── Stage 3: runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copier uniquement le dist compilé + node_modules de prod
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=apiuser:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=apiuser:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=apiuser:nodejs /app/packages/db/generated ./packages/db/generated
COPY --from=builder --chown=apiuser:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=apiuser:nodejs /app/packages/shared/dist ./packages/shared/dist

USER apiuser

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
