FROM node:current-alpine AS base
RUN adduser -D gtg-bot
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
RUN chown -R gtg-bot: /app
USER gtg-bot
ENTRYPOINT [ "node", "build/main.js" ]
