FROM node:current-alpine AS base

RUN npm install -g pnpm

FROM base AS app

RUN mkdir /app

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm build

ENTRYPOINT [ "node", "build/main.js" ]
