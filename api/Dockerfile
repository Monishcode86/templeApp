# Production Dockerfile for Node 24
FROM node:24-alpine AS base

# Install build dependencies if needed (e.g. for bcrypt native build on Alpine)
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create logs directory and set ownership to node user
RUN mkdir -p logs && chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Expose API port
EXPOSE 5000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start production server
CMD ["node", "index.js"]
