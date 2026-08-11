$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$siteUrl = 'http://127.0.0.1:5173/'
$healthTimeoutSeconds = 45
$logDirectory = Join-Path $projectRoot '.time-runtime'
$serverLog = Join-Path $logDirectory 'vite-server.log'
$serverErrorLog = Join-Path $logDirectory 'vite-server-error.log'

function Write-Step([string]$message) {
    Write-Host "[T.I.M.E.] $message" -ForegroundColor Cyan
}

function Test-TimeWebsite([string]$url = $siteUrl) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -eq 200 -and $response.Content -match 'T\.I\.M\.E\.')
    }
    catch {
        return $false
    }
}

function Get-LanIPv4 {
    $adapters = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object {
            $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
            $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback -and
            $_.GetIPProperties().GatewayAddresses.Count -gt 0
        } |
        Sort-Object Speed -Descending

    foreach ($adapter in $adapters) {
        $address = $adapter.GetIPProperties().UnicastAddresses |
            Where-Object {
                $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                -not $_.Address.IPAddressToString.StartsWith('169.254.')
            } |
            Select-Object -First 1
        if ($address) { return $address.Address.IPAddressToString }
    }
    return $null
}

function Show-Ready([string]$mobileUrl, [bool]$alreadyRunning = $false) {
    if ($alreadyRunning) {
        Write-Step '網站已經啟動，正在開啟電腦版首頁……'
    }
    else {
        Write-Step '網站已就緒，正在開啟電腦版首頁……'
    }
    Start-Process $siteUrl
    Write-Host ''
    Write-Host '============================================' -ForegroundColor DarkYellow
    Write-Host '  啟動完成' -ForegroundColor Green
    Write-Host ''
    Write-Host '  電腦網址：' -NoNewline -ForegroundColor Gray
    Write-Host $siteUrl -ForegroundColor Cyan
    Write-Host '  手機網址：' -NoNewline -ForegroundColor Yellow
    Write-Host $mobileUrl -ForegroundColor Green
    Write-Host '============================================' -ForegroundColor DarkYellow
    Write-Host ''
    Write-Host '請讓手機與這台電腦連接同一個 Wi-Fi／區域網路。' -ForegroundColor White
    Write-Host '若 Windows 第一次詢問防火牆權限，請勾選並允許「私人網路」。' -ForegroundColor Yellow
    Write-Host '此視窗將在 12 秒後自動關閉，網站服務會繼續運作。' -ForegroundColor DarkGray
    Start-Sleep -Seconds 12
}

function Test-PortInUse {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $client.BeginConnect('127.0.0.1', 5173, $null, $null)
        $connected = $asyncResult.AsyncWaitHandle.WaitOne(800, $false)
        if ($connected) { $client.EndConnect($asyncResult) }
        $client.Close()
        return $connected
    }
    catch {
        return $false
    }
}

function Find-Pnpm {
    $pathCommand = Get-Command 'pnpm.cmd' -ErrorAction SilentlyContinue
    if ($pathCommand) { return $pathCommand.Source }

    $bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $bundledPnpm) { return $bundledPnpm }

    return $null
}

function Find-Node {
    $pathCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if ($pathCommand) { return $pathCommand.Source }

    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { return $bundledNode }

    return $null
}

try {
    Write-Host ''
    Write-Host '============================================' -ForegroundColor DarkYellow
    Write-Host '  T.I.M.E. 時界異常事件處理局' -ForegroundColor Yellow
    Write-Host '  探員登錄系統啟動程序' -ForegroundColor Yellow
    Write-Host '============================================' -ForegroundColor DarkYellow
    Write-Host ''

    $lanAddress = Get-LanIPv4
    if (-not $lanAddress) {
        throw '找不到可用的區域網路 IPv4。請確認電腦已連上 Wi-Fi 或有線區域網路。'
    }
    $mobileUrl = "http://${lanAddress}:5173/"

    if (Test-TimeWebsite) {
        if (-not (Test-TimeWebsite $mobileUrl)) {
            throw '目前執行中的網站只允許本機存取。請先關閉舊的 Vite／Node.js 網站服務，再重新雙擊啟動檔。'
        }
        Show-Ready $mobileUrl $true
        exit 0
    }

    if (Test-PortInUse) {
        throw '連接埠 5173 已被其他程式使用，因此無法啟動 T.I.M.E.。請先關閉占用該連接埠的程式，再重新雙擊啟動檔。'
    }

    $pnpm = Find-Pnpm
    if (-not $pnpm) {
        throw '找不到 pnpm。請先安裝 Node.js 與 pnpm，或確認 Codex 的內建執行環境仍存在。'
    }

    $node = Find-Node
    if (-not $node) {
        throw '找不到 Node.js。請先安裝 Node.js，或確認 Codex 的內建執行環境仍存在。'
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json'))) {
        throw "找不到專案設定檔：$projectRoot\package.json"
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
        Write-Step '第一次啟動，正在安裝必要元件。這可能需要幾分鐘……'
        & $pnpm install --dir $projectRoot
        if ($LASTEXITCODE -ne 0) {
            throw '必要元件安裝失敗。請確認電腦可以連上網路，再重新執行啟動檔。'
        }
        Write-Step '必要元件安裝完成。'
    }

    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -ItemType Directory -Path $logDirectory | Out-Null
    }

    Write-Step '正在啟動網站服務……'
    $viteEntry = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteEntry)) {
        throw '找不到 Vite 執行檔。請刪除 node_modules 資料夾後重新執行啟動器，讓系統重新安裝必要元件。'
    }
    $serverArguments = @($viteEntry, '--host', '0.0.0.0', '--port', '5173', '--strictPort')
    $serverProcess = Start-Process -FilePath $node -ArgumentList $serverArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -PassThru

    Write-Step '等待網站準備完成……'
    $deadline = (Get-Date).AddSeconds($healthTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TimeWebsite) {
            Show-Ready $mobileUrl
            exit 0
        }

        if ($serverProcess.HasExited) {
            $standardLog = if (Test-Path -LiteralPath $serverLog) { Get-Content -LiteralPath $serverLog -Raw -ErrorAction SilentlyContinue } else { '' }
            $errorLog = if (Test-Path -LiteralPath $serverErrorLog) { Get-Content -LiteralPath $serverErrorLog -Raw -ErrorAction SilentlyContinue } else { '' }
            $details = "$standardLog`n$errorLog"
            throw "網站服務提前停止。`n`n錯誤紀錄：`n$details"
        }
        Start-Sleep -Milliseconds 700
    }

    throw "等待網站啟動超過 $healthTimeoutSeconds 秒。請查看紀錄檔：$serverLog"
}
catch {
    Write-Host ''
    Write-Host 'T.I.M.E. 啟動失敗' -ForegroundColor Red
    Write-Host '------------------' -ForegroundColor DarkRed
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
