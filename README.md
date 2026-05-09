# 🌴 Jungle Crash

Jogo de crash gambling full-stack construído com NestJS, React, Keycloak, RabbitMQ e PostgreSQL.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun 1.3 |
| Backend (games) | NestJS 11, porta 4001 |
| Backend (wallets) | NestJS 11, porta 4002 |
| ORM | Prisma 4.15 + PostgreSQL |
| Mensageria | RabbitMQ 4 (topic exchange `domain.events`) |
| WebSocket | socket.io 4 |
| API Gateway | Kong 3.9 (DB-less), porta 8000 |
| Identidade | Keycloak 26 (realm `crash-game`, PKCE S256) |
| Frontend | React 19 + Vite 8, porta 5173 (dev) / 3000 (prod) |

## Setup rápido

### Pré-requisitos

- [Bun](https://bun.sh) ≥ 1.3
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Instalar dependências

```bash
bun install            # raiz (workspaces)
bun install --cwd services/games
bun install --cwd services/wallets
bun install --cwd frontend
```

### 2. Subir o ambiente completo

```bash
bun run docker:up
```

O script `docker:up`:
1. Faz build das imagens e sobe todos os containers em background
2. Aguarda o PostgreSQL ficar pronto
3. Roda `prisma migrate deploy` para cada serviço com schema
4. Exibe os logs em follow

### 3. Acessar

| Serviço | URL |
|---|---|
| Frontend (prod) | http://localhost:3000 |
| Frontend (dev) | `bun run dev` em `frontend/` → http://localhost:5173 |
| API Gateway | http://localhost:8000 |
| Swagger — games | http://localhost:4001/docs |
| Swagger — wallets | http://localhost:4002/docs |
| Keycloak Admin | http://localhost:8080 (admin/admin) |
| RabbitMQ UI | http://localhost:15672 (admin/admin) |

### Usuário de teste

| Campo | Valor |
|---|---|
| Username | `player` |
| Password | `player123` |
| Email | player@crash-game.dev |

## Testes

```bash
# Unitários — games
bun test --cwd services/games tests/unit

# Unitários — wallets
bun test --cwd services/wallets tests/unit

# E2E (requer docker:up)
bun test --cwd services/games tests/e2e
bun test --cwd services/wallets tests/e2e
```

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│   Keycloak OIDC PKCE → JWT → Kong → services    │
└────────────────────┬────────────────────────────┘
                     │ HTTP / WebSocket
              ┌──────▼──────┐
              │  Kong 8000  │  (API Gateway, DB-less)
              └──┬──────┬───┘
                 │      │
        /games/* │      │ /wallets/*
                 │      │
    ┌────────────▼──┐  ┌▼─────────────┐
    │  games :4001  │  │ wallets :4002 │
    │  NestJS + WS  │  │   NestJS      │
    └───────┬───────┘  └──────┬────────┘
            │                 │
            └────┬────────────┘
                 │ AMQP (RabbitMQ)
          ┌──────▼──────┐
          │  RabbitMQ   │  exchange: domain.events
          └─────────────┘
            │         │
       games ◄─────── wallets
    (WalletDebited /  (WalletDebitRequested /
     WalletCredited /  WalletCreditRequested)
     WalletDebitFailed)
```

### Padrões implementados

- **DDD**: entidades de domínio (`Round`, `Bet`) sem dependências de infraestrutura
- **Outbox Pattern**: eventos publicados em transação com a operação de domínio; worker publica no broker de forma assíncrona
- **Idempotência**: tabela `ProcessedRequest` garante que cada requisição seja processada exatamente uma vez
- **Saga (Choreography)**: `games` publica `WalletDebitRequested` → `wallets` processa e publica `WalletDebited` ou `WalletDebitFailed` → `games` confirma ou cancela a aposta
- **Provably Fair**: cada rodada tem `serverSeed` aleatório cujo hash é publicado antes do crash; após a rodada o seed é revelado para verificação

### Decisões de trade-off

| Decisão | Motivo |
|---|---|
| Prisma `output = "../node_modules/.prisma/client"` | Bun usa symlinks no `node_modules`; output explícito garante que o client gerado fique no caminho correto dentro da imagem Docker |
| `jwtVerify` sem verificação de issuer | Tokens emitidos pelo Keycloak têm `iss: http://localhost:8080/...` mas dentro do Docker o serviço acessa `http://keycloak:8080/...`; verificar o issuer causaria falha em produção |
| `jose` em vez de `passport-jwt` | Menor footprint de dependências; compatibilidade nativa com Bun |
| Bun como runtime | Performance superior ao Node.js para I/O intensivo; test runner built-in; instalação de dependências mais rápida |

## Variáveis de ambiente

Cada serviço tem `.env.example`. Copie para `.env` e ajuste se necessário:

```bash
cp services/games/.env.example services/games/.env
cp services/wallets/.env.example services/wallets/.env
cp frontend/.env.example frontend/.env
```
