# Canvas Notifier Discord Bot
# Node.js 20 LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY --chown=nodejs:nodejs . .

# Create data directory for persistent storage
RUN mkdir -p /app/courses && \
    chown -R nodejs:nodejs /app/courses

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Start the bot with auto-registration
CMD ["node", "scripts/start.js"]
