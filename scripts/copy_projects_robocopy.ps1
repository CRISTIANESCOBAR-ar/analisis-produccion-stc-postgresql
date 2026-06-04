<#
.SYNOPSIS
    Copia (o refleja) carpetas de proyectos desde una máquina origen Windows (UNC) hacia la máquina destino usando `robocopy`.

.DESCRIPTION
    Usa rutas UNC para copiar `stc-produccion-v2` y `stc-mezclas-poc`. Requiere que el origen tenga compartido el recurso (p. ej. C$ o una carpeta explícita).

.EXAMPLE
    .\copy_projects_robocopy.ps1 -SourceUNC "\\ORIGEN_PC\C$\ruta\stc-produccion-v2" -DestinationPath "C:\stc-produccion-v2" -Mirror
#>

param(
    [Parameter(Mandatory=$true)][string]$SourceUNC,
    [Parameter(Mandatory=$true)][string]$DestinationPath,
    [switch]$Mirror,
    [int]$Retries = 3
)

function Write-Log { param($m) Write-Host "[INFO] $m" }
function Write-Err { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

if (-not (Get-Command robocopy -ErrorAction SilentlyContinue)) {
    Write-Err "robocopy no está disponible en este sistema (debería estar en Windows)."; exit 10
}

if (-not (Test-Path $SourceUNC)) { Write-Err "No se puede acceder a la ruta origen: $SourceUNC"; exit 11 }

if (-not (Test-Path $DestinationPath)) { Try { New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null } Catch { Write-Err "No se pudo crear $DestinationPath: $_"; exit 12 } }

$log = Join-Path $env:TEMP ("robocopy_$(Get-Date -Format yyyyMMdd_HHmmss).log")

if ($Mirror) {
    $args = @('/MIR','/Z',"/R:$Retries",'/W:5','/MT:8','/NFL','/NDL','/NP','/LOG:' + $log)
} else {
    $args = @('/E','/COPY:DAT',"/R:$Retries",'/W:5','/MT:8','/LOG:' + $log)
}

$cmd = @($SourceUNC, $DestinationPath, '*.*') + $args
Write-Log "Ejecutando: robocopy $($cmd -join ' ')"

& robocopy @cmd
$rc = $LASTEXITCODE

# robocopy exit codes < 8 son considerados éxito/aviso
if ($rc -lt 8) {
    Write-Log "Robocopy finalizó correctamente (código $rc). Log: $log"
} else {
    Write-Err "Robocopy finalizó con error (código $rc). Revisa $log"
    exit 20
}

*** End Patch