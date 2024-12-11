# Use an official Node.js runtime as the base image
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx tsc --skipLibCheck

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY .env topics.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
