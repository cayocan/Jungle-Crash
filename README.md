# 🌴 Jungle Crash

> **Nota sobre desenvolvimento assistido por IA**
> Este projeto foi desenvolvido com auxílio de ferramentas de IA (GitHub Copilot) para acelerar a escrita de código boilerplate, geração de testes e documentação.
>
> **Destaque importante para entrega:** a IA foi usada somente para acelerar implementação e validações, e **eu domino 100% da codebase**. Todo o código foi revisado por mim, entendo integralmente as decisões técnicas e consigo explicar cada módulo do sistema de ponta a ponta.

Jogo de crash gambling full-stack construído com NestJS, React, Keycloak, RabbitMQ e PostgreSQL. Desenvolvido como resposta ao desafio técnico Full-stack da **Jungle Gaming**.

---

## Checklist dos requisitos eliminatórios

| Requisito | Status |
|---|---|
| `bun run docker:up` sobe tudo sem passos manuais | ✅ |
| Gameplay completo (apostar → multiplicador → cashout/crash → liquidação) | ✅ |
| Dois microserviços comunicando via RabbitMQ | ✅ |
| Sincronização em tempo real — múltiplas abas mostram o mesmo estado | ✅ |
| Precisão monetária — sem ponto flutuante, saldo nunca negativo | ✅ |
| Autenticação via Keycloak (PKCE S256) — backend valida JWTs | ✅ |
| Testes unitários + E2E | ✅ |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun 1.3 |
| Backend (games) | NestJS 11 — porta 4001 |
| Backend (wallets) | NestJS 11 — porta 4002 |
| ORM | Prisma + PostgreSQL 18 |
| Mensageria | RabbitMQ 4 — exchange `domain.events` (topic) |
| WebSocket | socket.io 4 (`@nestjs/websockets`) |
| API Gateway | Kong 3.9 DB-less — porta 8000 |
| Identidade | Keycloak 26.5.5 — realm `crash-game`, PKCE S256 |
| Frontend | React 19 + Vite 8 + TypeScript strict |
| Estilo | Tailwind CSS v4 |
| Estado servidor | TanStack Query v5 |
| Estado cliente | Zustand v5 |
| Testes unitários/backend E2E | Bun test runner |
| Testes browser E2E | Playwright 1.59 |
| Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Infra | Docker Compose |

---

## Setup rápido

### Pré-requisitos

- [Bun](https://bun.sh) ≥ 1.3
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Comando único (subir e rodar tudo)

```bash
bun run docker:up
```

Esse comando único já automatiza o bootstrap completo:
1. Copia `.env.example` para `.env` (se necessário)
2. Builda e sobe todos os containers
3. Aguarda Postgres e aplica migrations
4. Executa testes unitários
5. Executa testes E2E (Playwright)
6. Mantém logs em follow

### Comandos opcionais

```bash
bun install                      # opcional: instala dependências localmente
bun run test:playwright:install  # opcional: pré-instala browsers Playwright
```

### Acessar

| Serviço | URL |
|---|---|
| Frontend (prod) | http://localhost:3000 |
| Frontend (dev) | `bun run dev` em `frontend/` → http://localhost:5173 |
| API Gateway | http://localhost:8000 |
| Swagger — games | http://localhost:4001/docs |
| Swagger — wallets | http://localhost:4002/docs |
| Keycloak Admin | http://localhost:8080 (admin / admin) |
| RabbitMQ UI | http://localhost:15672 (admin / admin) |

### Usuário de teste pré-configurado

| Campo | Valor |
|---|---|
| Username | `player` |
| Password | `player123` |
| Email | player@crash-game.dev |
| Saldo inicial | R$ 1.000,00 (100.000 centavos) |

O usuário é provisionado automaticamente pelo Keycloak realm import e a carteira é criada na primeira vez que o jogador acessa o frontend.

### Parar / limpar

```bash
bun run docker:down    # Para os containers
bun run docker:prune   # Remove tudo (containers, volumes, imagens)
```

---

## Testes

### Comandos rápidos

```bash
# Todos os unitários (games + wallets)
bun run test:unit

# Backend E2E (requer docker:up)
bun run test:e2e:backend

# Playwright — testes de browser E2E
bun run test:playwright

# Playwright com UI interativa
bun run test:playwright:ui  # cd e2e && npx playwright test --ui
```

### Unitários

```bash
bun test --cwd services/games tests/unit
bun test --cwd services/wallets tests/unit
```

| Arquivo | O que testa |
|---|---|
| `round.test.ts` | Ciclo de vida do Round (BETTING → RUNNING → CRASHED), invariantes de Bet, `computeCrashPoint()`, hash chain |
| `game.service.test.ts` | Loop de estado do GameService, transições de fase |
| `outbox.publisher.test.ts` | OutboxWorker: publicação de eventos e idempotência |
| `wallet.consumer.test.ts` | WalletDebited, WalletDebitFailed, WalletCredited, confirmação de aposta |
| `wallet.test.ts` | Crédito, débito, saldo insuficiente, precisão com centavos BigInt |

### Backend E2E (requer `bun run docker:up`)

```bash
bun test --cwd services/games tests/e2e
bun test --cwd services/wallets tests/e2e
```

| Arquivo | O que testa |
|---|---|
| `game.e2e.test.ts` | GET /rounds/current, GET /rounds/history, POST /bet (401/400), GET /bets/me |
| `deterministic.e2e.test.ts` | Seeds conhecidas: HMAC-SHA256, rounds no histórico, `/rounds/:id/verify` |
| `wallet.e2e.test.ts` | POST /wallets, GET /wallets/me |

### Playwright — browser E2E (requer `bun run docker:up`)

```bash
cd e2e
npx playwright test              # headless (todos os projetos)
npx playwright test --headed     # com browser visível
npx playwright test --ui         # UI interativa (recomendado para debug)
npx playwright show-report       # relatório HTML após execução

# Filtros úteis
npx playwright test api          # só os testes de API
npx playwright test --project=chromium     # só Chromium
npx playwright test --project=mobile-chrome
```

| Arquivo | Projeto(s) | O que testa |
|---|---|---|
| `auth.setup.ts` | `setup` | Login Keycloak PKCE — persiste storage state para os demais testes |
| `game.spec.ts` | `chromium`, `mobile-chrome` | Estrutura da GamePage, painel de apostas, aba Auto Bet, modal Provably Fair, toggle leaderboard |
| `login.spec.ts` | `chromium`, `mobile-chrome` | Página de login sem auth (usa `test.use` para limpar cookies), redirect para Keycloak, proteção de rota |
| `api.spec.ts` | `chromium`, `mobile-chrome` | Contratos REST via Kong: rounds (shape, paginação, commitamento), leaderboard (sem prejuízo, shape), auth 401, rate limit headers |
| `wallet.spec.ts` | `chromium`, `mobile-chrome` | Exibição de saldo no header, formato monetário, GET /wallets/me autenticado e 401 sem token |
| `bet-flow.spec.ts` | `chromium`, `mobile-chrome` | Validações de input (valor mínimo, vazio, não-numérico), ciclo de aposta, aposta duplicada rejeitada, feedback de UI |
| `provably-fair.spec.ts` | `chromium`, `mobile-chrome` | Modal com hash + crash point, fechar modal, botão ƒ(t), endpoint /verify, hash chain SHA256 verificado em Node |
| `auto-bet.spec.ts` | `chromium`, `mobile-chrome` | Aba Auto Bet: campos de estratégia, Fixo vs Martingale, multiplicador padrão, stop-loss, validações de input |

**Projetos Playwright:**
- `setup` → autentica e salva storage state
- `chromium` + `mobile-chrome` → todos os testes autenticados
- `login.spec.ts` usa `test.use({ storageState: { cookies: [], origins: [] } })` e roda sem auth em qualquer projeto

---

## Bônus implementados ⭐

Todos os itens bônus do desafio, exceto Observabilidade e Storybook:

| Bônus | Implementação |
|---|---|
| **Outbox/Inbox transacional** | `OutboxWorker` escreve eventos na mesma transação do banco antes de publicar no broker; `ProcessedRequest` garante idempotência no consumo (exactly-once) |
| **Auto cashout** | Campo `autoCashoutAt` na aposta; tick loop dispara cashout automático quando multiplicador >= alvo; UI com input dedicado |
| **Auto bet** | Componente `AutoBet.tsx` com estratégias Martingale (dobra após derrota) e Valor Fixo; configuração de stop-loss, stop-on-win e máximo de rodadas |
| **Efeitos sonoros** | Web Audio API procedural (sem arquivos externos): sons distintos para aposta, cashout, crash e tick do multiplicador |
| **Leaderboard** | Top jogadores pelo **maior lucro de uma única rodada** (sem prejuízo, sem somas negativas); toggle 24h / 7d; exibe multiplicador da melhor rodada |
| **CI pipeline** | GitHub Actions: 3 jobs paralelos — `test-games`, `test-wallets`, `build-frontend`; roda em push/PR para qualquer branch |
| **Rate limiting** | Kong: 120 req/min global, 30 req/min em `/games`; retorna 429 com headers padrão |
| **Fórmula da curva na UI** | Botão ƒ(t) no gráfico exibe tooltip com fórmula `m(t) = max(1.0, e^(0.00006·t))` e tabela de exemplos em pontos-chave |
| **Seed determinística para E2E** | Script `bun run seed:e2e` insere 5 rounds SETTLED com SERVER_SEED fixo para crash points reproduzíveis |
| **Playwright E2E** | 4 arquivos de teste browser: auth setup, game page, login, contratos de API; projetos chromium + mobile-chrome; integrado ao `docker:up` |

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│   Keycloak OIDC PKCE → JWT → Kong → services    │
└────────────────────┬────────────────────────────┘
                     │ HTTP / WebSocket
              ┌──────▼──────┐
              │  Kong 8000  │  (API Gateway, DB-less, rate limiting)
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
          │  RabbitMQ   │  exchange: domain.events (topic)
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
| **DDD** | `services/*/src/domain/` | `Round` e `Bet` encapsulam invariantes sem dependências de infra; fácil de unit-testar |
| **Outbox Pattern** | `OutboxWorker` em games e wallets | Eventos escritos na mesma transação do banco; sem dual-write; at-least-once delivery |
| **Idempotência (Inbox)** | Tabela `ProcessedRequest` | Cada `requestId` processado exatamente uma vez; permite retry seguro |
| **Saga (Coreografia)** | games ↔ wallets via RabbitMQ | Sem orquestrador central; cada serviço reage a eventos |
| **CQRS light** | `RoundRepository` | Writes via entidade de domínio; reads com queries SQL diretas |
| **Provably Fair** | `Round.computeCrashPoint()` | Crash determinístico e verificável pelo jogador após a rodada |
| **walletConfirmed** | `Bet.walletConfirmed` | Cashout bloqueado até débito confirmado via evento; edge case de round fechado antes da confirmação → reembolso automático |

---

## Decisões de arquitetura e trade-offs

### 1. Por que dois microserviços?

A separação `games` / `wallets` reflete fronteiras de domínio reais: o serviço de jogos é **stateful** (estado de rodada em memória + WebSocket) enquanto o serviço de carteiras é **stateless** (CRUD financeiro com consistência forte). Colocá-los no mesmo processo causaria contenção entre o loop de multiplicador (CPU/timer) e as transações de saldo (I/O de banco).

**Trade-off:** Aumenta a complexidade operacional (dois bancos, mensageria assíncrona). Para um MVP, um monólito seria suficiente — a separação demonstra o padrão Saga corretamente.

### 2. Saga de Coreografia — fluxo de aposta

```
jogador          games :4001            RabbitMQ               wallets :4002
   │                  │                     │                        │
   │── POST /bet ────►│                     │                        │
   │                  │── WalletDebitRequested ──────────────────────►│
   │◄── 201 betId ────│  (roundId, userId, amountCents, requestId)    │
   │                  │                     │                        │── debita saldo
   │                  │                     │◄── WalletDebited ───────│  (ou WalletDebitFailed)
   │                  │ confirmBetDebit()   │
   │◄── WS: bet_placed│ walletConfirmed=true│
```

O campo `walletConfirmed` garante que o cashout só é permitido após o débito ser confirmado pelo serviço de wallets. Se a rodada crashar antes da confirmação chegar, o serviço emite `WalletCreditRequested` para reembolsar o jogador — garantindo saldo nunca negativo mesmo em condições de race condition.

**Por que coreografia e não orquestração?** Nenhum serviço conhece o outro diretamente — apenas publicam e consomem eventos. Facilita adicionar consumidores (ex: antifraude) sem alterar código existente.

**Trade-off:** Dificulta o rastreamento de fluxos com falha. Mitigado pelo `requestId` único rastreável nos logs de ambos os serviços.

### 3. Comunicação síncrona vs. assíncrona

| Caminho | Protocolo | Motivo |
|---|---|---|
| Frontend → games (round state) | WebSocket (socket.io) | Atualizações sub-segundo do multiplicador; HTTP polling seria caro |
| Frontend → games/wallets (REST) | HTTP via Kong | Ações pontuais (apostar, sacar, verificar saldo) |
| games → wallets (debit/credit) | AMQP (RabbitMQ) | Desacoplamento temporal; wallets pode estar temporariamente offline sem perder mensagens |

### 4. Algoritmo Provably Fair

O crash point é determinístico e verificável *após* cada rodada:

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

**Trade-off:** O `salt` é gerado pelo servidor (não pelo jogador). Um sistema completo usaria um salt commitado pelo jogador antes de cada rodada para eliminar 100% da confiança no servidor.

### 5. Precisão monetária

Todos os valores monetários são armazenados como `BIGINT` em centavos (`amountCents`). Nunca há aritmética de ponto flutuante em cálculos financeiros. O multiplicador é aplicado como inteiro multiplicado por centavos, depois arredondado para baixo — garantindo que o jogador nunca receba um centavo a mais do que o cálculo exato.

### 6. Decisões técnicas pontuais

| Decisão | Motivo |
|---|---|
| Prisma `output = "../node_modules/.prisma/client"` | Bun usa symlinks no `node_modules`; output explícito garante o caminho correto dentro da imagem Docker. Imports apontam diretamente para `node_modules/.prisma/client` (não `@prisma/client`) para evitar ambiguidade de resolução de tipos em workspaces Bun |
| `jwtVerify` sem verificação de `issuer` | `iss` dos tokens usa `localhost:8080` mas dentro do Docker o hostname é `keycloak:8080`; verificar causaria 401 em todos os requests |
| `jose` em vez de `passport-jwt` | Menor footprint; compatibilidade nativa com Bun sem patches de polyfill |
| Bun como runtime | Performance superior ao Node.js para I/O; test runner built-in; workspaces nativos |
| Kong DB-less (declarativo) | Sem banco de dados para o gateway; config versionada no repositório; reinicialização é idempotente |
| Apostas aceitas de forma otimista (201 imediato) | Reduz latência percebida pelo jogador; cancelamento assíncrono via `bet_rejected` WS é raro e tratado no frontend |
| GlobalExceptionFilter em ambos os serviços | Mapeia erros de domínio conhecidos para HTTP semanticamente correto (409, 402, 404) em vez de 500 genérico; mensagens de erro legíveis pelo frontend |
| Web Audio API procedural | Sem arquivos de áudio externos — sons gerados matematicamente; zero dependências adicionais e funciona offline |

---

## Estrutura do projeto

```
jungle-crash/
├── e2e/                        # Playwright E2E (browser)
│   ├── tests/
│   │   ├── auth.setup.ts       # Login Keycloak, persiste storage state
│   │   ├── game.spec.ts        # GamePage completa (autenticado)
│   │   ├── login.spec.ts       # Página de login (sem auth)
│   │   └── api.spec.ts         # Contratos REST via Kong
│   └── playwright.config.ts
├── services/
│   ├── games/                  # Game Service (NestJS, porta 4001)
│   │   ├── src/
│   │   │   ├── domain/         # Round, Bet, invariantes, Provably Fair
│   │   │   ├── application/    # GameService, loop de rodada
│   │   │   ├── repositories/   # RoundRepository (Prisma)
│   │   │   ├── messaging/      # OutboxWorker, ConsumerService
│   │   │   ├── infrastructure/ # PrismaModule, RabbitMQ
│   │   │   └── presentation/   # Controllers, WebSocket Gateway, Filters
│   │   ├── tests/
│   │   │   ├── unit/           # round, game.service, outbox, wallet.consumer
│   │   │   └── e2e/            # game, deterministic (Provably Fair)
│   │   └── scripts/
│   │       └── seed-e2e.ts     # Seed determinístico (5 rounds com crash points fixos)
│   └── wallets/                # Wallet Service (NestJS, porta 4002)
│       ├── src/
│       │   ├── domain/         # Wallet, operações de crédito/débito
│       │   ├── application/    # WalletService
│       │   ├── messaging/      # OutboxWorker, ConsumerService
│       │   └── presentation/   # Controllers, Filters
│       └── tests/
│           ├── unit/           # wallet, outbox, wallet.consumer
│           └── e2e/            # wallet CRUD
├── frontend/                   # React 19 + Vite 8 (nginx, porta 3000)
│   └── src/
│       ├── auth/               # AuthProvider, PKCE S256, token refresh
│       ├── components/         # CrashGraph, BetPanel, AutoBet, RoundHistory,
│       │                       # Leaderboard, BetHistory, ProvablyFairModal
│       ├── hooks/              # useGameSocket, useWallet, useSounds, useProvablyFair
│       ├── pages/              # GamePage, LoginPage, CallbackPage
│       └── store/              # Zustand — estado do jogo em tempo real
├── docker/
│   ├── kong/kong.yml           # Config declarativa do API Gateway
│   ├── keycloak/               # Realm export (auto-importado no docker:up)
│   └── postgres/init-databases.sh
├── .github/workflows/ci.yml    # GitHub Actions CI
├── docker-compose.yml
└── package.json                # Scripts: docker:up, docker:down, docker:prune
```

---

## Eventos WebSocket

O servidor emite eventos para **todos os clientes conectados**. Todas as ações do jogador (apostar, sacar) são feitas via REST.

| Evento | Payload (resumido) | Quando |
|---|---|---|
| `round_state` | `{ status, multiplier, bets[], serverSeedHash }` | Reconexão — snapshot completo |
| `betting_phase` | `{ roundId, serverSeedHash, endsAt }` | Início da fase de apostas |
| `round_started` | `{ roundId }` | Fim das apostas, multiplicador começa |
| `multiplier_tick` | `{ multiplier, elapsed }` | A cada tick do loop (~100ms) |
| `round_crashed` | `{ crashPoint, serverSeed, salt }` | Crash — revela seed para verificação |
| `bet_placed` | `{ userId, username, amountCents }` | Nova aposta confirmada |
| `bet_cashed_out` | `{ userId, username, multiplier, payout }` | Cashout realizado |
| `bet_rejected` | `{ userId, reason }` | Aposta cancelada (saldo insuficiente) |
| `balance_updated` | `{ userId, balanceCents, type }` | Saldo alterado (debit/credit) |

---

## Variáveis de ambiente

Cada serviço tem `.env.example`. O script `docker:up` copia automaticamente se `.env` não existir. Para rodar fora do Docker:

```bash
cp services/games/.env.example services/games/.env
cp services/wallets/.env.example services/wallets/.env
cp frontend/.env.example frontend/.env
```

---

## Seed determinística (E2E / demo)

Para popular o banco com 5 rounds SETTLED com crash points conhecidos (útil para demonstrar Provably Fair):

```bash
bun run seed:e2e --cwd services/games
```

| CLIENT_SEED | CRASH POINT |
|---|---|
| `00000001` | 2.94x |
| `deadbeef` | 12.99x |
| `12345678` | 1.11x |
| `cafebabe` | 4.74x |
| `aabbccdd` | 2.10x |

Todos verificáveis via `GET /games/rounds/:id/verify` ou pela UI (modal Provably Fair).
