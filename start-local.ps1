# Starts the canteen app locally without Docker: PostgreSQL (Windows service),
# the FastAPI backend on http://localhost:8000 and the Vite frontend on
# http://localhost:5173. Servers already running are left alone.
#
#   powershell -ExecutionPolicy Bypass -File .\start-local.ps1
#
# Stop both servers with:
#   Get-NetTCPConnection -State Listen -LocalPort 8000,5173 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

$backend = Join-Path $PSScriptRoot 'backend'
$frontend = Join-Path $PSScriptRoot 'frontend'

function Test-Port($port) {
    [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Wait-Url($url, $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep 2 }
    }
    return $false
}

$pg = Get-Service postgresql* -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $pg) {
    Write-Warning "No PostgreSQL service found."
} elseif ($pg.Status -ne 'Running') {
    Write-Host "Starting $($pg.Name)..."
    Start-Service $pg.Name
}

if (Test-Port 8000) {
    Write-Host "Backend already running."
} else {
    # Windows Smart App Control blocks the libpq DLL bundled in psycopg-binary,
    # so use the pure-Python driver with PostgreSQL's own libpq instead.
    $libpq = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\libpq.dll' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($libpq) {
        $env:PATH = "$($libpq.DirectoryName);$env:PATH"
        $env:PSYCOPG_IMPL = 'python'
    }
    Write-Host "Starting backend..."
    Start-Process -FilePath "$backend\venv\Scripts\python.exe" `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000' `
        -WorkingDirectory $backend -WindowStyle Hidden `
        -RedirectStandardOutput "$backend\uvicorn_out.log" -RedirectStandardError "$backend\uvicorn_err.log"
}

if (Test-Port 5173) {
    Write-Host "Frontend already running."
} else {
    Write-Host "Starting frontend..."
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev -- --host 127.0.0.1 --port 5173' `
        -WorkingDirectory $frontend -WindowStyle Hidden `
        -RedirectStandardOutput "$frontend\vite_out.log" -RedirectStandardError "$frontend\vite_err.log"
}

# The backend can take a minute or two on a cold start.
$backendUp = Wait-Url 'http://127.0.0.1:8000/health' 180
$frontendUp = Wait-Url 'http://127.0.0.1:5173' 60

if ($backendUp) { Write-Host "Backend:  http://localhost:8000  (docs at /docs)" }
else { Write-Warning "Backend didn't start. Last lines of backend\uvicorn_err.log:"; Get-Content "$backend\uvicorn_err.log" -Tail 15 }
if ($frontendUp) { Write-Host "Frontend: http://localhost:5173" }
else { Write-Warning "Frontend didn't start. See frontend\vite_err.log." }
