FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "cp -r /app/dist/* /app/dist/ 2>/dev/null; tail -f /dev/null"]
