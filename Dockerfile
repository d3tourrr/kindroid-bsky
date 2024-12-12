FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
COPY /src/set_timezone.sh ./set_timezone.sh
RUN npm install
COPY . .
RUN npx tsc --skipLibCheck

FROM node:18-alpine
RUN apk add --no-cache tzdata
COPY --from=builder /app/set_timezone.sh /usr/local/bin/set_timezone.sh
RUN chmod +x /usr/local/bin/set_timezone.sh
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY .env config.json ./
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/set_timezone.sh"]
CMD ["node", "dist/index.js"]
