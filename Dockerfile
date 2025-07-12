FROM node:18-alpine

# Install ffmpeg and curl for health checks
RUN apk add --no-cache ffmpeg curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create directories
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Start the application
CMD ["npm", "start"]