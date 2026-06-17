FROM node:16-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application
FROM node:16-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built assets from the previous stage
COPY --from=0 /app/build ./build

# Expose port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "build", "-l", "3000"]
