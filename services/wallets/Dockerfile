FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Ensure Prisma client is generated inside the image so @prisma/client is ready at runtime
RUN bunx prisma generate || true

EXPOSE 4002

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/main.ts"]
