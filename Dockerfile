FROM node:current-alpine AS base
RUN mkdir /app
WORKDIR /app
RUN npm install -g pnpm

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build

FROM base AS app
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENTRYPOINT [ "node", "build/main.js" ]
