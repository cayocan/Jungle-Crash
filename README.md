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

| Padrão | Onde | Benefício |
|---|---|---|
| **DDD** | `services/games/src/domain/` | `Round` e `Bet` encapsulam invariantes sem dependências de infra; fácil de unit-testar |
| **Outbox Pattern** | `OutboxWorker` em games e wallets | Eventos são escritos na mesma transação do banco; worker publica no broker de forma assíncrona, eliminando dual-write |
| **Idempotência** | Tabela `ProcessedRequest` | Cada `requestId` é processado exatamente uma vez; permite retry seguro do lado do cliente |
| **Saga (Coreografia)** | `games` ↔ `wallets` via RabbitMQ | Sem orquestrador central; cada serviço reage a eventos e publica o próximo passo |
| **CQRS light** | `RoundRepository` | Writes via entidade de domínio; reads com queries SQL diretas sem passar pela entidade |
| **Provably Fair** | `Round.computeCrashPoint()` | Crash determinístico verificável pelo jogador após a rodada |

---

### Decisões de arquitetura e trade-offs

#### 1. Por que dois microserviços em vez de um monólito?

A separação `games` / `wallets` reflete fronteiras de domínio reais: o serviço de jogos é **stateful** (mantém o estado de rodada em memória + WebSocket) enquanto o serviço de carteiras é **stateless** (CRUD financeiro com consistência forte). Colocá-los no mesmo processo causaria contenção de recursos entre o loop de multiplicador (CPU/timer) e as transações de saldo (I/O de banco).

**Trade-off:** Aumenta a complexidade operacional (dois bancos, mensageria assíncrona). Para um MVP, um monólito seria suficiente — a separação foi escolhida para demonstrar o padrão Saga corretamente.

---

#### 2. Saga de Coreografia (fluxo de aposta)

```
jogador          games :4001            RabbitMQ               wallets :4002
   │                  │                     │                        │
   │── POST /bet ────►│                     │                        │
   │                  │── WalletDebitRequested ──────────────────────►│
   │◄── 201 betId ────│  (roundId, userId, amountCents, requestId)    │
   │                  │                     │                        │── debita saldo
   │                  │                     │◄── WalletDebited ───────│  (ou WalletDebitFailed)
   │                  │◄── confirma aposta ─│
   │◄── WS: bet_placed│    (ou cancela)     │
```

**Por que coreografia e não orquestração?** Nenhum dos serviços conhece o outro diretamente — eles apenas publicam e consomem eventos. Isso facilita adicionar novos consumidores (ex.: serviço de antifraude) sem alterar o código existente.

**Trade-off:** Dificulta o rastreamento de fluxos com falha (não há um "processo central" para inspecionar). Mitigado pelo `requestId` único rastreável nos logs de ambos os serviços.

---

#### 3. Comunicação síncrona vs. assíncrona

| Caminho | Protocolo | Motivo |
|---|---|---|
| Frontend → games (round state) | WebSocket (socket.io) | Atualizações sub-segundo do multiplicador; HTTP polling seria caro |
| Frontend → games/wallets (REST) | HTTP via Kong | Ações pontuais (apostar, sacar, verificar saldo) |
| games → wallets (debit/credit) | AMQP (RabbitMQ) | Desacoplamento temporal; wallets pode estar temporariamente offline sem perder mensagens |

---

#### 4. Algoritmo Provably Fair

O ponto de crash é determinístico e verificável *após* cada rodada:

```
h = HMAC-SHA256(key = serverSeed, data = salt)
n = parseInt(h[0..12], 16)          // 52 bits do hash
e = 2^52

rawCrash = (100 * e - n) / (e - n)
crashPoint = max(1.00, floor(rawCrash) / 100)
```

**Protocolo de verificação:**
1. Antes da rodada: servidor publica `SHA256("public" || serverSeed)` como `serverSeedHash`
2. Após a rodada: servidor revela `serverSeed` e `salt`
3. Jogador verifica: `SHA256("public" || serverSeed) == serverSeedHash` ✓ e recomputa o crash

**Trade-off:** O `salt` é gerado pelo servidor (não pelo jogador), então o jogador precisa confiar que o salt não foi manipulado post-hoc. Um sistema completo usaria um salt commitado pelo jogador antes de cada rodada.

---

#### 5. Decisões técnicas pontuais

| Decisão | Motivo |
|---|---|
| Prisma `output = "../node_modules/.prisma/client"` | Bun usa symlinks no `node_modules`; output explícito garante o caminho correto dentro da imagem Docker |
| `jwtVerify` sem verificação de `issuer` | `iss` dos tokens usa `localhost:8080` mas dentro do Docker o hostname é `keycloak:8080`; verificar causaria 401 em todos os requests |
| `jose` em vez de `passport-jwt` | Menor footprint; compatibilidade nativa com Bun sem patches de polyfill |
| Bun como runtime | Performance superior ao Node.js para I/O; test runner built-in; workspaces nativos |
| Kong DB-less (declarativo) | Sem banco de dados para o gateway; config versionada no repositório; reinicialização é idempotente |
| `amountCents` como `bigint` no domínio | Evita erros de ponto-flutuante em cálculos financeiros; serializado como string no JSON |
| Apostas aceitas de forma otimista (201 imediato) | Reduz latência percebida pelo jogador; o cancelamento assíncrono via `bet_rejected` WS é raro e tratado no frontend |

---

### Estratégia de testes

```
┌──────────────────────────────────────────────────┐
│  Unit (bun test tests/unit)                      │
│  • Round.computeCrashPoint() — algoritmo PF      │
│  • GameService lógica de estado                  │
│  • Sem I/O, sem banco, sem rede                  │
├──────────────────────────────────────────────────┤
│  E2E (bun test tests/e2e)                        │
│  • Requer docker compose up -d                   │
│  • Cenários de negócio contra serviços reais:    │
│    - Happy path cashout                          │
│    - Crash (aposta perdida)                      │
│    - Saldo insuficiente (saga WalletDebitFailed) │
│    - Aposta dupla (rejeitada com 409/500)        │
└──────────────────────────────────────────────────┘
```

## Variáveis de ambiente

Cada serviço tem `.env.example`. Copie para `.env` e ajuste se necessário:

```bash
cp services/games/.env.example services/games/.env
cp services/wallets/.env.example services/wallets/.env
cp frontend/.env.example frontend/.env
```
