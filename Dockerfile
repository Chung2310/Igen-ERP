# Step 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package management files (only yarn.lock to avoid npm conflicts)
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies needed for build)
# NODE_ENV must NOT be "production" here so devDeps are installed
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.cache/yarn yarn install --frozen-lockfile

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
FROM node:22-alpine AS runner

# CÃ i ca-certificates vÃ  tzdata (Alpine)
RUN apk add --no-cache ca-certificates tzdata ffmpeg chromium nss freetype harfbuzz ttf-freefont

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first to leverage Docker build cache for node_modules
COPY --from=builder /app/package.json /app/yarn.lock ./

# Install only production dependencies
RUN --mount=type=cache,target=/root/.cache/yarn yarn install --production --frozen-lockfile

# Copy only the compiled output directories from builder.
# dist/ = static frontend assets (publicly served via express.static)
# dist-server/ = bundled Express server (must stay outside the publicly served
# directory â€” it is never served over HTTP)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/assets/fonts ./server/assets/fonts
COPY --from=builder /app/server/modules/marketing-suite/campaign/service/agents/skills ./server/modules/marketing-suite/campaign/service/agents/skills

# Expose Express server port
EXPOSE 3000

# Run the bundled production server
# T?o thu m?c logs và gán quy?n cho user node
RUN mkdir -p /app/logs && chown -R node:node /app

USER node

# Run the bundled production server v?i gi?i h?n heap d? ch?ng memory leak làm phình swap trên VPS
CMD ["node", "--max-old-space-size=1536", "dist-server/server.cjs"]
