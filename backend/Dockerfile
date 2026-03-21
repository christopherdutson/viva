FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Install all deps (including devDependencies) at startup so tsx and @types/node
# are always available regardless of NODE_ENV, then start the server.
# Use tsx directly (not npm run dev) since env vars come from docker-compose, not a .env file.
CMD ["sh", "-c", "npm install --include=dev && npm start"]
