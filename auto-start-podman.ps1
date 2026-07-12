# ============================================================
# auto-start-podman.ps1
# Se ejecuta automáticamente al iniciar sesión en Windows.
# Levanta Podman machine + contenedor PostgreSQL.
# Log: C:\stc-produccion-v2\podman-autostart.log
# ============================================================

$logFile = "C:\stc-produccion-v2\podman-autostart.log"
$startDbScript = "C:\stc-produccion-v2\start-db.ps1"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

# Limpiar log viejo (mantener solo último arranque)
if (Test-Path $logFile) { Remove-Item $logFile -Force }

Write-Log "========== INICIO AUTO-START PODMAN =========="
Write-Log "Usuario: $env:USERNAME | PC: $env:COMPUTERNAME"

# ---------- 1. Esperar a que el sistema esté listo ----------
Write-Log "Esperando 15 segundos para que Windows termine de arrancar..."
Start-Sleep -Seconds 15

# ---------- 2. Forzar habilitación de WSLService ----------
# Algo deshabilita este servicio al reiniciar. Lo forzamos cada vez.
Write-Log "Habilitando WSLService..."
try {
    $svcStatus = (Get-Service -Name "WSLService" -ErrorAction SilentlyContinue)
    if ($svcStatus) {
        if ($svcStatus.StartType -eq 'Disabled') {
            Write-Log "WSLService estaba DESHABILITADO. Habilitando..."
            sc.exe config WSLService start= demand 2>&1 | ForEach-Object { Write-Log "  sc: $_" }
        }
        if ($svcStatus.Status -ne 'Running') {
            Write-Log "WSLService no estaba corriendo. Iniciando..."
            net start WSLService 2>&1 | ForEach-Object { Write-Log "  net: $_" }
        }
        Write-Log "WSLService OK."
    } else {
        Write-Log "[WARN] Servicio WSLService no encontrado."
    }
} catch {
    Write-Log "[WARN] Error al verificar WSLService: $_"
}

# ---------- 3. Verificar que WSL responde ----------
Write-Log "Verificando WSL..."
$maxRetries = 10
$retryCount = 0

do {
    $retryCount++
    try {
        $wslResult = wsl echo "ok" 2>&1
        if ($wslResult -match "ok") {
            Write-Log "WSL responde correctamente (intento $retryCount)"
            break
        }
    } catch {
        Write-Log "WSL no responde aún (intento $retryCount/$maxRetries)"
    }
    Start-Sleep -Seconds 5
} while ($retryCount -lt $maxRetries)

if ($retryCount -ge $maxRetries) {
    Write-Log "[ERROR] WSL no respondió después de $maxRetries intentos. Abortando."
    exit 1
}

# ---------- 3. Iniciar Podman machine ----------
Write-Log "Verificando estado de Podman machine..."

$machineStatus = podman machine inspect --format "{{.State}}" 2>&1
Write-Log "Estado actual de la máquina: $machineStatus"

if ($machineStatus -match "running") {
    Write-Log "Podman machine ya está corriendo. Saltando inicio."
} else {
    Write-Log "Iniciando Podman machine..."
    $startResult = podman machine start 2>&1
    Write-Log "Resultado: $startResult"

    # Verificar que arrancó
    Start-Sleep -Seconds 3
    try {
        podman info --format "{{.Host.RemoteSocket.Path}}" 1>$null 2>$null
        Write-Log "Podman machine iniciada correctamente."
    } catch {
        Write-Log "[ERROR] Podman machine no respondió después del arranque."
        exit 1
    }
}

# ---------- 4. Ejecutar start-db.ps1 ----------
Write-Log "Ejecutando start-db.ps1..."

if (Test-Path $startDbScript) {
    try {
        Set-Location "C:\stc-produccion-v2"
        & $startDbScript 2>&1 | ForEach-Object { Write-Log "  DB: $_" }
        Write-Log "start-db.ps1 completado exitosamente."
    } catch {
        Write-Log "[ERROR] start-db.ps1 falló: $_"
        exit 1
    }
} else {
    Write-Log "[ERROR] No se encontró $startDbScript"
    exit 1
}

Write-Log "========== AUTO-START COMPLETADO =========="
