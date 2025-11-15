# ==============================================================================
# Multi-stage Dockerfile for Levantafia Frontend - React + Vite + Nginx
# ==============================================================================
# Optimized for production deployment with CloudFront CDN
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Stage - Node.js Build
# ------------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Build application
# API URL will be set via environment variable at runtime
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Runtime Stage - Nginx
# ------------------------------------------------------------------------------
FROM nginx:1.25-alpine

# Metadata
LABEL maintainer="levantafia"
LABEL description="Levantafia Photo Upload Frontend - React SPA"
LABEL version="1.0.0"

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configurations
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create writable directories for nginx user
RUN mkdir -p /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi && \
    chown -R nginx:nginx /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    touch /tmp/nginx.pid && \
    chown nginx:nginx /tmp/nginx.pid

# Use non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
