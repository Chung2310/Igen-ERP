# Step 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package management files (only yarn.lock to avoid npm conflicts)
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies needed for build)
# NODE_ENV must NOT be "production" here so devDeps are installed
ENV NODE_ENV=development
# Keep Yarn's cache in the mount instead of the image layer.
RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn install --frozen-lockfile --cache-folder /root/.cache/yarn

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

# Cài ca-certificates và tzdata (Alpine)
RUN apk add --no-cache ca-certificates tzdata ffmpeg chromium nss freetype harfbuzz ttf-freefont

WORKDIR /app

# Set ownership before dependencies or cache mounts create any files.
RUN mkdir -p /home/node/.cache/yarn \
    && chown node:node /app /home/node/.cache /home/node/.cache/yarn

ENV NODE_ENV=production
ENV PORT=3000
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first to leverage Docker build cache for node_modules
COPY --from=builder --chown=node:node /app/package.json /app/yarn.lock ./

# Install as the runtime user so node_modules needs no later recursive chown.
USER node
RUN --mount=type=cache,target=/home/node/.cache/yarn,uid=1000,gid=1000 \
    yarn install --production --frozen-lockfile --cache-folder /home/node/.cache/yarn

# Copy only the compiled output directories from builder.
# dist/ = static frontend assets (publicly served via express.static)
# dist-server/ = bundled Express server (must stay outside the publicly served
# directory — it is never served over HTTP)
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/dist-server ./dist-server
COPY --from=builder --chown=node:node /app/server/assets/fonts ./server/assets/fonts
COPY --from=builder --chown=node:node /app/server/modules/marketing-suite/campaign/service/agents/skills ./server/modules/marketing-suite/campaign/service/agents/skills

# Expose Express server port
EXPOSE 3000

# Run the bundled production server
# Create runtime directories as their owner without copying earlier layers.
RUN mkdir -p /app/logs /app/uploads /app/server/cache/ai-settlements

# Run the production server with a heap limit
CMD ["node", "--max-old-space-size=1536", "dist-server/server.cjs"]
