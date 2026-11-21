param([switch]$ResetDemo)
$ErrorActionPreference = 'Stop'
$backendPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $backendPath
try {
    node scripts/check-database.mjs --files-only
    if ($LASTEXITCODE -ne 0) { throw 'Migration files are not synchronized.' }
    npx.cmd supabase start
    if ($LASTEXITCODE -ne 0) { throw 'Supabase failed to start. Check Docker Desktop.' }
    if ($ResetDemo) {
        Write-Warning 'ResetDemo deletes this local project database and recreates demo data.'
        npx.cmd supabase db reset --local
        if ($LASTEXITCODE -ne 0) { throw 'Database reset failed.' }
    }
    node scripts/check-database.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Old schema detected. Read backend/README.md before resetting demo data.' }
    $configText = Get-Content -Raw supabase/config.toml
    $projectName = [regex]::Match($configText, '(?m)^project_id\s*=\s*"([^"\r\n]+)"').Groups[1].Value
    Get-Content -Raw scripts/schedule_meter_reminders.sql | docker exec -i "supabase_db_$projectName" psql -U postgres -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Could not schedule meter reminders.' }
    Write-Host 'Database ready. Run npx.cmd supabase functions serve in backend, then configure frontend/.env and run npm.cmd run dev.'
} finally { Pop-Location }
