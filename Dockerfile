# Step 1: Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package management files (only yarn.lock to avoid npm conflicts)
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies needed for build)
# NODE_ENV must NOT be "production" here so devDeps are installed
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.yarn-cache \
    yarn install --frozen-lockfile --cache-folder /root/.yarn-cache

# Copy the entire workspace (excluding files in .dockerignore)
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Remove package-lock.json if it exists (avoid conflicts with yarn.lock)
RUN rm -f package-lock.json

# Show Node.js and Yarn versions for debugging
RUN node --version && yarn --version

# Build the Vite frontend SPA and bundle the Express server using esbuild
# Increase Node.js heap size to avoid OOM errors on large bundles
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN yarn build

# Step 2: Production runner stage
# IMPORTANT: Must use Debian (glibc) - Alpine (musl libc) is NOT compatible with Remotion/Chromium
FROM node:22-bookworm-slim AS runner

# Install system tools for video rendering:
# - ffmpeg: video encoding/processing
# - fonts: text overlay support (including CJK/Vietnamese characters)
# - chromium + deps: headless browser for Remotion rendering (requires glibc/Debian)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    fonts-freefont-ttf \
    fonts-noto-cjk \
    chromium \
    libnss3 \
    libfreetype6 \
    libharfbuzz0b \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Tell Remotion/Puppeteer to use system Chromium on Debian
# Chromium on Debian/bookworm is at /usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

# Copy only the compiled output directory from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock ./

# Copy Remotion entrypoint and video composition template for runtime Webpack bundling
COPY --from=builder /app/server/remotion ./server/remotion
COPY --from=builder /app/src/components/content-studio/video-composition.tsx ./src/components/content-studio/video-composition.tsx

# Install only production dependencies
RUN --mount=type=cache,target=/root/.yarn-cache \
    yarn install --production --frozen-lockfile --cache-folder /root/.yarn-cache

# Expose Express server port
EXPOSE 3000

# Run the bundled production server
CMD ["node", "dist/server.cjs"]
