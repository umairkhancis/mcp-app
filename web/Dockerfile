# Multi-stage Dockerfile for web project
# Stage 1: Build
FROM node:18-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files and build configuration
COPY . .

# Build the project (generates assets)
RUN pnpm run build

# Stage 2: Production
FROM node:18-alpine

# Install wget for health check
RUN apk add --no-cache wget

# Install serve package globally
RUN npm install -g serve@14.2.4

# Set working directory
WORKDIR /app

# Copy only the built assets from builder
COPY --from=builder /app/assets ./assets

# Expose the port
EXPOSE 4444

# Set environment variable for base URL (can be overridden)
ENV BASE_URL=http://localhost:4444

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4444/ || exit 1

# Start the static file server
CMD ["serve", "-s", "./assets", "-p", "4444", "--cors"]

