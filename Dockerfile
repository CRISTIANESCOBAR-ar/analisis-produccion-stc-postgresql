# Multi-stage build: frontend (Vite) + backend (Express)

# 1) Build frontend
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build

# 2) Install backend dependencies (production only)
FROM node:22-alpine AS build-backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

# 3) Runtime
FROM node:22-alpine3.21 AS runtime
RUN apk add --no-cache postgresql16-client
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_DIST=/app/frontend/dist

COPY --from=build-backend /app/backend ./backend
COPY --from=build-frontend /app/frontend/dist ./frontend/dist
COPY shared/ ./shared/

EXPOSE 3001
CMD ["node", "backend/server.js"]
