# backend/Dockerfile
FROM node:18-alpine

# Install build tools for native dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all backend source code
COPY . .

# Build TypeScript if needed
RUN npm run build

# Expose backend port       
EXPOSE 3000

# Start the backend
CMD ["node", "dist/index.js"]