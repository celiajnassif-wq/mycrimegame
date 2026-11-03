# For hosts that run containers (Fly.io, Railway, a VPS). Render can use render.yaml instead.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY schema ./schema
COPY cases ./cases
COPY tsconfig.json ./
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
