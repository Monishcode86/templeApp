param(
    [Parameter(Mandatory=$true)]
    [string]$Executable,

    [Parameter(Mandatory=$true)]
    [string]$WorkingDir,

    [int]$Port = 5998,
    [int]$TimeoutSeconds = 45
)

$env:PORT = [string]$Port
$env:LOG_DIR = "logs"

$outLog = Join-Path $WorkingDir "preflight_stdout.log"
$errLog = Join-Path $WorkingDir "preflight_stderr.log"

# Clean prior pre-flight logs if present
if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

function Test-PortOpen([string]$HostName, [int]$PortNum, [int]$TimeoutMs = 250) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $tcp.BeginConnect($HostName, $PortNum, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            $tcp.EndConnect($ar)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $tcp.Close()
    }
}

$proc = Start-Process -FilePath $Executable -WorkingDirectory $WorkingDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
$status = "TIMEOUT"
$httpCode = 0

try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($proc.HasExited) {
            $status = "EXITED_EARLY"
            break
        }

        # Fast TCP port readiness check (avoids blocking 2s web request when closed)
        if (Test-PortOpen "127.0.0.1" $Port 250) {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
                $httpCode = [int]$response.StatusCode
                if ($httpCode -eq 200 -and $response.Content -match '"status":\s*"OK"') {
                    $status = "PASS"
                    break
                }
            } catch {
                if ($_.Exception.Response) {
                    $httpCode = [int]$_.Exception.Response.StatusCode
                }
            }
        }
        Start-Sleep -Milliseconds 400
    }
} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        [void]$proc.WaitForExit(3000)
    }

    # If stdout log is empty, attach recent application log for diagnostics
    if ((-not (Test-Path $outLog)) -or ((Get-Item $outLog).Length -eq 0)) {
        $recentAppLog = Get-ChildItem (Join-Path $WorkingDir "logs\app-*.log") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($recentAppLog) {
            Get-Content $recentAppLog.FullName -Tail 50 | Out-File -FilePath $outLog -Encoding utf8
        }
    }
}

Write-Output "$status|$httpCode"
