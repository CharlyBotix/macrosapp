# Node 22+ is required for the built-in node:sqlite module (no native
# compilation needed, which keeps ARM64/Raspberry Pi builds simple and fast).
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/books.db

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "src/server.js"]
