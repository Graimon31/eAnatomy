FROM node:20-alpine AS base
WORKDIR /app

# Backend
FROM base AS backend-deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm install

FROM base AS backend
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ ./
EXPOSE 4000
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/server.ts"]

# Frontend build
FROM base AS frontend-deps
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

FROM base AS frontend
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]
