# Use lightweight Node.js image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install build dependencies for sqlite3
RUN apk add --no-cache python3 make g++

# Install production dependencies
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose port 3000 (standard for Render/Health Checks)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
