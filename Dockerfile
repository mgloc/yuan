FROM node:25-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:25-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 YUAN_DB=/data/yuan.sqlite
COPY package.json ./
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
CMD ["node", "server/main.ts"]
