# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native addon compilation if required
RUN apk add --no-cache python3 make g++

# Copy root dependency manifests
COPY package.json package-lock.json tsconfig.json ./

# Copy UI dependency manifests
COPY ui/package.json ui/package-lock.json ./ui/

# Install dependencies for both backend and frontend
RUN npm ci && npm --prefix ui ci

# Copy source code
COPY src/ ./src/
COPY ui/ ./ui/

# Build TypeScript backend and Vite React frontend into dist/
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8045 \
    HOST=0.0.0.0 \
    CONFIG_DIR=/config

# Install runtime libraries for native C++ bindings (better-sqlite3)
RUN apk add --no-cache libstdc++

# Copy dependency manifests and install production-only dependencies
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built distribution artifacts (server, types, adapters, services, public)
COPY --chown=node:node --from=builder /app/dist ./dist

# Create volume mount directory with ownership for non-root node user
RUN mkdir -p /config && chown -R node:node /config

USER node

EXPOSE 8045

VOLUME ["/config"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8045/health || exit 1

ENTRYPOINT ["node", "dist/index.js"]
