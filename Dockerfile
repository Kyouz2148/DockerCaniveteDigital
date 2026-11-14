FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/.data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_DRIVER=sqlite
ENV SQLITE_PATH=/app/.data/canivete.db

VOLUME ["/app/.data"]
EXPOSE 8080

CMD ["node", "server.js"]
