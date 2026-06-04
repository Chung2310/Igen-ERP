# Step 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package management files
COPY package.json yarn.lock ./

# Install devDependencies and dependencies for bundling
RUN yarn install

# Copy the entire workspace
COPY . .

# Build the Vite frontend SPA and bundle the Express server using esbuild
RUN yarn build

# Step 2: Production runner stage (keeps the final image lightweight)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only the compiled output directory from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock ./

# Install only production dependencies
RUN yarn install --production

# Expose Express server port
EXPOSE 3000

# Run the bundled production server
CMD ["node", "dist/server.cjs"]
