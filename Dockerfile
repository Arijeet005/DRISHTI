FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --include=dev

COPY . .

# Prisma Client generation needs DATABASE_URL to exist, but doesn't connect to it.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]