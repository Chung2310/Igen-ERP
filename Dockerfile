# Step 1: Build stage
FROM node:22-alpine AS builder

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

RUN apk add --no-cache ffmpeg

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

# Install ffmpeg and fonts for video rendering/text drawing
RUN apk add --no-cache ffmpeg fontconfig ttf-freefont

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

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
