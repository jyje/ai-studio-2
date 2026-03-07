# ============================================
# Production Dockerfile (Multi-stage build)
# ============================================

# Stage 1: Builder - Install dependencies and build the application
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Build the Next.js application
# Set NODE_ENV=production for standalone output
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Runner - Minimal runtime image
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
# Standalone mode creates a minimal server with all dependencies
# Next.js standalone output structure:
# .next/standalone/
#   ├── server.js (main entry point)
#   ├── node_modules/
#   └── package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
# In standalone mode, server.js is in the root of the copied standalone directory
CMD ["node", "server.js"]
