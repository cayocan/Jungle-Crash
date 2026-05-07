param()

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

Write-Host "Starting Docker Compose (build + detach)..."
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose up failed"
  exit $LASTEXITCODE
}

if (-not (Wait-For-Postgres -Retries 90 -DelaySeconds 2)) {
  Write-Error "Postgres readiness timeout. Aborting migrations."
  exit 1
}

$bunExe = Get-BunExe
if (-not $bunExe) {
  Write-Error "bun not found in PATH and not present at $env:USERPROFILE\.bun\bin\bun.exe. Please install Bun and restart your shell." 
  exit 1
}

# Find services that have a prisma schema and run migrations from host (so migration files persist)
$services = Get-ChildItem -Directory -Path "services" | ForEach-Object { $_ }
foreach ($svc in $services) {
  $schema = Join-Path $svc.FullName "prisma\schema.prisma"
  if (Test-Path $schema) {
    Write-Host "Preparing migrations for service: $($svc.Name)"

    Push-Location $svc.FullName
    try {
      Write-Host "Running 'bun install' in $($svc.FullName)"
      & $bunExe install
      if ($LASTEXITCODE -ne 0) {
        Write-Error "bun install failed in $($svc.FullName)"
        Pop-Location
        exit $LASTEXITCODE
      }

      # Use localhost to reach the Postgres instance from host
      $origDb = $env:DATABASE_URL
      $env:DATABASE_URL = "postgresql://admin:admin@127.0.0.1:5432/$($svc.Name)"

      $migrationsDir = Join-Path $svc.FullName "prisma\migrations"
      if (Test-Path $migrationsDir) {
        Write-Host "Applying existing migrations for $($svc.Name)..."
        & $bunExe x prisma migrate deploy --schema prisma/schema.prisma
      } else {
        Write-Host "Creating initial migration for $($svc.Name) and applying it (prisma migrate dev)..."
        & $bunExe x prisma migrate dev --name init --schema prisma/schema.prisma
      }

      if ($LASTEXITCODE -ne 0) {
        Write-Error "Prisma migrations failed for $($svc.Name)"
        Pop-Location
        exit $LASTEXITCODE
      }

    } finally {
      if ($origDb -ne $null) { $env:DATABASE_URL = $origDb } else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
      Pop-Location
    }
  }
}

Write-Host "Migrations complete. Attaching to docker compose logs (press Ctrl+C to stop)"
docker compose up
