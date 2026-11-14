# ---- Stage 1: Build --------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Stage 2: Production runtime -------------------------------------------
FROM node:20-alpine AS runner

# RESTRICTIONS.md §4 / CLAUDE.md: non-root containers
RUN addgroup -S vitalis && adduser -S vitalis -G vitalis

WORKDIR /app

# Production-only node_modules
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Compiled application (includes dist/server.js, dist/engine/thresholds.yaml, dist/knowledge, dist/llm/prompts)
COPY --from=builder /app/dist ./dist

USER vitalis

ENV NODE_ENV=production

EXPOSE 8000

CMD ["node", "dist/server.js"]

