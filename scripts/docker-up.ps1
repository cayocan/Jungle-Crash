param()

Set-StrictMode -Off

function Get-BunExe {
  $bunCmd = Get-Command bun -ErrorAction SilentlyContinue
  if ($bunCmd) { return $bunCmd.Source }
  $candidate = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
  if (Test-Path $candidate) { return $candidate }
  return $null
}

function Wait-For-Postgres {
  param(
    [int]$Retries = 60,
    [int]$DelaySeconds = 2
  )

  for ($i = 1; $i -le $Retries; $i++) {
    Write-Host "Checking Postgres readiness (attempt $i/$Retries)..."
    try {
      docker compose exec -T postgres pg_isready -U admin -d postgres > $null 2>&1
      if ($LASTEXITCODE -eq 0) {
        Write-Host "Postgres is ready."
        return $true
      }
    } catch {
      # ignore and retry
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  Write-Error "Postgres did not become ready after $Retries attempts."
  return $false
}

# ─── Step 1: Auto-create .env files from .env.example (fresh clone support) ───
Write-Host ""
Write-Host "=== [1/6] Checking environment files... ==="
$envPairs = @(
  @{ src = "services/games/.env.example";   dst = "services/games/.env" },
  @{ src = "services/wallets/.env.example"; dst = "services/wallets/.env" },
  @{ src = "frontend/.env.example";         dst = "frontend/.env" }
)
foreach ($pair in $envPairs) {
  if (-not (Test-Path $pair.dst)) {
    Write-Host "  Creating $($pair.dst) from $($pair.src)..."
    Copy-Item $pair.src $pair.dst
  } else {
    Write-Host "  $($pair.dst) already exists — skipping."
  }
}

# ─── Step 2: Build and start all containers ─────────────────────────────────
Write-Host ""
Write-Host "=== [2/6] Starting Docker Compose (build + detach)... ==="
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose up failed"
  exit 1
}

# ─── Step 3: Wait for Postgres, then run migrations from host ────────────────
Write-Host ""
Write-Host "=== [3/6] Waiting for PostgreSQL... ==="
if (-not (Wait-For-Postgres -Retries 90 -DelaySeconds 2)) {
  Write-Error "Postgres readiness timeout. Aborting."
  exit 1
}

# Migrations also run inside each Docker CMD (bunx prisma migrate deploy).
# Running them from the host as well is safe (idempotent) and ensures the
# migration files on disk stay in sync even when volumes are fresh.
$bunExe = Get-BunExe
if ($bunExe) {
  Write-Host "bun found at: $bunExe"
  $services = Get-ChildItem -Directory -Path "services"
  foreach ($svc in $services) {
    $schema = Join-Path $svc.FullName "prisma\schema.prisma"
    if (-not (Test-Path $schema)) { continue }

    Write-Host "  Running migrations for $($svc.Name)..."
    Push-Location $svc.FullName
    try {
      # Install deps in case this is a fresh clone with no node_modules
      & $bunExe install 2>&1 | Out-Null

      $origDb = $env:DATABASE_URL
      $env:DATABASE_URL = "postgresql://admin:admin@127.0.0.1:5432/$($svc.Name)"

      $migrationsDir = Join-Path $svc.FullName "prisma\migrations"
      if (Test-Path $migrationsDir) {
        & $bunExe x prisma migrate deploy --schema prisma/schema.prisma
      } else {
        & $bunExe x prisma migrate dev --name init --schema prisma/schema.prisma
      }

      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Prisma migrations returned non-zero for $($svc.Name) — service will retry on startup."
      }
    } finally {
      if ($null -ne $origDb) { $env:DATABASE_URL = $origDb }
      else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
      Pop-Location
    }
  }
} else {
  Write-Warning "bun not found on host — skipping host-side migrations (services handle them at startup via CMD)."
}

# ─── Step 4: Run unit tests ──────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [4/6] Running unit tests... ==="
$unitsFailed = $false
if ($bunExe) {
  $gamesUnit = & $bunExe test --cwd services/games tests/unit 2>&1
  $gamesUnit | Write-Host
  if ($LASTEXITCODE -ne 0) { $unitsFailed = $true }

  $walletsUnit = & $bunExe test --cwd services/wallets tests/unit 2>&1
  $walletsUnit | Write-Host
  if ($LASTEXITCODE -ne 0) { $unitsFailed = $true }

  if ($unitsFailed) {
    Write-Warning "Some unit tests failed — check output above."
  } else {
    Write-Host "All unit tests passed."
  }
} else {
  Write-Warning "bun not found — skipping unit tests."
}

# ─── Step 5: Run Playwright E2E tests ────────────────────────────────────────
Write-Host ""
Write-Host "=== [5/6] Waiting for services to be healthy before Playwright... ==="

function Wait-For-Http {
  param([string]$Url, [int]$Retries = 30, [int]$DelaySeconds = 3)
  for ($i = 1; $i -le $Retries; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
      if ($r.StatusCode -lt 500) { return $true }
    } catch { }
    Write-Host "  Waiting for $Url (attempt $i/$Retries)..."
    Start-Sleep -Seconds $DelaySeconds
  }
  return $false
}

$frontendReady = Wait-For-Http -Url "http://localhost:3000" -Retries 30 -DelaySeconds 3
$gamesReady    = Wait-For-Http -Url "http://localhost:4001/health" -Retries 30 -DelaySeconds 3

if (-not $frontendReady) {
  Write-Warning "Frontend did not become ready — skipping Playwright tests."
} elseif (-not $gamesReady) {
  Write-Warning "Games service did not become ready — skipping Playwright tests."
} else {
  Write-Host "Services are ready. Running Playwright tests..."

  # Install browsers if not already installed
  $pwBrowsers = Join-Path $PSScriptRoot "..\e2e\node_modules\.bin\playwright"
  Push-Location (Join-Path $PSScriptRoot "..\e2e")
  try {
    # Ensure node_modules exist for e2e package
    if ($bunExe) { & $bunExe install 2>&1 | Out-Null }

    $pwExe = Resolve-Path "node_modules\.bin\playwright" -ErrorAction SilentlyContinue
    if (-not $pwExe) {
      Write-Warning "Playwright not installed in e2e/ — run 'bun run test:playwright:install' first."
    } else {
      npx playwright install --with-deps chromium 2>&1 | Out-Null
      npx playwright test 2>&1
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Some Playwright tests failed — run 'bun run test:playwright' to see the full report."
      } else {
        Write-Host "All Playwright tests passed."
      }
    }
  } finally {
    Pop-Location
  }
}

# ─── Step 6: Tail logs ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [6/6] All services started. Tailing logs (Ctrl+C to stop) ==="
Write-Host ""
Write-Host "  Frontend  → http://localhost:3000"
Write-Host "  Games API → http://localhost:4001/docs"
Write-Host "  Wallets   → http://localhost:4002/docs"
Write-Host "  Keycloak  → http://localhost:8080  (admin/admin)"
Write-Host "  RabbitMQ  → http://localhost:15672  (admin/admin)"
Write-Host "  Kong GW   → http://localhost:8000"
Write-Host ""
docker compose logs --follow --tail=50
