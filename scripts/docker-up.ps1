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
Write-Host "=== [1/4] Checking environment files... ==="
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
Write-Host "=== [2/4] Starting Docker Compose (build + detach)... ==="
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose up failed"
  exit 1
}

# ─── Step 3: Wait for Postgres, then run migrations from host ────────────────
Write-Host ""
Write-Host "=== [3/4] Waiting for PostgreSQL... ==="
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

# ─── Step 4: Tail logs ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [4/4] All services started. Tailing logs (Ctrl+C to stop) ==="
Write-Host ""
Write-Host "  Frontend  → http://localhost:3000"
Write-Host "  Games API → http://localhost:4001/docs"
Write-Host "  Wallets   → http://localhost:4002/docs"
Write-Host "  Keycloak  → http://localhost:8080  (admin/admin)"
Write-Host "  RabbitMQ  → http://localhost:15672  (admin/admin)"
Write-Host "  Kong GW   → http://localhost:8000"
Write-Host ""
docker compose logs --follow --tail=50
