# Step 1: Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package management files (only yarn.lock to avoid npm conflicts)
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies needed for build)
# NODE_ENV must NOT be "production" here so devDeps are installed
ENV NODE_ENV=development
RUN yarn install --frozen-lockfile

# Copy the entire workspace (excluding files in .dockerignore)
COPY . .

# Remove package-lock.json if it exists (avoid conflicts with yarn.lock)
RUN rm -f package-lock.json

# Show Node.js and Yarn versions for debugging
RUN node --version && yarn --version

# Build the Vite frontend SPA and bundle the Express server using esbuild
# Increase Node.js heap size to avoid OOM errors on large bundles
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# Step 2: Production runner stage (keeps the final image lightweight)
FROM node:22-slim AS runner

# Cài Chromium + dependencies cho Remotion render (Debian)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    ffmpeg \
    fonts-freefont-ttf \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files first to leverage Docker build cache for node_modules
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/.puppeteerrc.cjs ./.puppeteerrc.cjs

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

# Copy only the compiled output directory from builder
COPY --from=builder /app/dist ./dist

# Copy Remotion entrypoint and video composition template for runtime Webpack bundling
COPY --from=builder /app/server/remotion ./server/remotion
COPY --from=builder /app/src/components/content-studio/video-composition.tsx ./src/components/content-studio/video-composition.tsx

# Expose Express server port
EXPOSE 3000

# Run the bundled production server
CMD ["node", "dist/server.cjs"]
