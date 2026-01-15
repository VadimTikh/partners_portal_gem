# Dockerfile for Miomente Partner Portal (Fullstack Next.js)

# 1. Base image
FROM node:20-alpine AS base

# 2. Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else npm install; \
  fi

# 3. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ARG NEXT_PUBLIC_USE_REAL_API=true
ENV NEXT_PUBLIC_USE_REAL_API=$NEXT_PUBLIC_USE_REAL_API

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 4. Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone .
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Runtime environment variables (set these when running the container):
# - DATABASE_URL: PostgreSQL connection string (Supabase)
# - MAGENTO_DB_HOST: MySQL host
# - MAGENTO_DB_PORT: MySQL port (default 3306)
# - MAGENTO_DB_USER: MySQL user
# - MAGENTO_DB_PASSWORD: MySQL password
# - MAGENTO_DB_NAME: MySQL database name
# - JWT_SECRET: Secret for JWT signing (min 32 chars)
# - SENDGRID_API_KEY: SendGrid API key for emails
# - EMAIL_FROM: From email address
# - APP_URL: Base URL of the application
# - ODOO_URL: Odoo JSON-RPC URL
# - ODOO_DB: Odoo database name
# - ODOO_USER_ID: Odoo user ID
# - ODOO_API_KEY: Odoo API key

CMD ["node", "server.js"]
