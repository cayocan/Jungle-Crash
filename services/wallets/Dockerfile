FROM oven/bun:1

WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

# Ensure Prisma client is generated inside the image so @prisma/client is ready at runtime
RUN bunx prisma generate || true

EXPOSE 4002

CMD ["bun", "run", "src/main.ts"]
