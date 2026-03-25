FROM node:20-alpine AS base
WORKDIR /app

# ══════════════════════════════════════════════════════════════
# BACKEND
# ══════════════════════════════════════════════════════════════
FROM base AS backend-deps
COPY backend/package.json ./
RUN npm install --legacy-peer-deps

FROM base AS backend
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/package.json backend/tsconfig.json ./
COPY backend/src ./src
# Create public dir for static assets (may be empty initially)
RUN mkdir -p public/slices
EXPOSE 4000
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/server.ts"]

# ══════════════════════════════════════════════════════════════
# FRONTEND
# ══════════════════════════════════════════════════════════════
FROM base AS frontend-deps
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps

FROM base AS frontend
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]
