# Base stage for shared configuration and dependencies
FROM node:16-alpine AS base
WORKDIR /app
COPY package*.json ./
# Install dependencies including devDependencies for development
RUN npm install

# Development stage: Source code is mapped via volumes, but we copy it for safety
FROM base AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
# npm start will be handled by docker-compose override or this default
CMD ["npm", "start"]

# Build stage: Create the production build
FROM base AS build
COPY . .
RUN npm run build

# Production stage: Serve the built application
FROM node:16-alpine AS production
WORKDIR /app
RUN npm install -g serve
# Only copy the build artifacts
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
