# Local static server for the weather app.
# Logs one line per request to stdout (timestamp, client, method, path, status).

$prefix = 'http://localhost:8080/'

# Security headers sent with every response
$csp = "default-src 'self'; script-src 'self'; style-src 'self'; " +
       "connect-src 'self' https://nominatim.openstreetmap.org https://api.weather.gov; " +
       "img-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
$securityHeaders = @{
    'Content-Security-Policy' = $csp
    'X-Content-Type-Options'  = 'nosniff'
    'X-Frame-Options'         = 'DENY'
    'Referrer-Policy'         = 'no-referrer'
}

# Remove control and non-ASCII characters and cap length so a request path can't forge log lines
function Write-Log($remote, $method, $path, $status) {
    $safePath = ($path -replace '[^\x20-\x7E]', '?')
    if ($safePath.Length -gt 200) { $safePath = $safePath.Substring(0, 200) }
    $safeMethod = ($method -replace '[^A-Za-z]', '?')
    Write-Host ("{0} {1} {2} {3} {4}" -f (Get-Date -Format 'o'), $remote, $safeMethod, $safePath, $status)
}

# Forward POST /api/summary to the Node summary service and relay the streamed reply chunk by chunk.
# Returns the HTTP status sent to the browser. Returns 502 if the service is unreachable.
Add-Type -AssemblyName System.Net.Http
$summaryClient = New-Object System.Net.Http.HttpClient
$summaryClient.Timeout = [TimeSpan]::FromSeconds(120)

function Send-SummaryProxy($request, $response) {
    $maxBody = 8192
    try {
        $ms = New-Object System.IO.MemoryStream
        $request.InputStream.CopyTo($ms)
        $bodyBytes = $ms.ToArray()
        if ($bodyBytes.Length -gt $maxBody) { $response.StatusCode = 413; return 413 }

        $content = New-Object System.Net.Http.ByteArrayContent(,$bodyBytes)
        $content.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue('application/json')
        $msg = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, 'http://127.0.0.1:8081/api/summary')
        $msg.Content = $content
        $upstream = $summaryClient.SendAsync($msg, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    } catch {
        $response.StatusCode = 502
        return 502
    }

    try {
        $code = [int]$upstream.StatusCode
        $response.StatusCode = $code
        $ct = $upstream.Content.Headers.ContentType
        $response.ContentType = if ($ct) { $ct.ToString() } else { 'text/plain; charset=utf-8' }
        $response.Headers.Add('Cache-Control', 'no-store')
        $response.SendChunked = $true
        $stream = $upstream.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $buffer = New-Object byte[] 4096
        while (($n = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $response.OutputStream.Write($buffer, 0, $n)
            $response.OutputStream.Flush()
        }
        return $code
    } finally {
        $upstream.Dispose()
    }
}

# Binding is the port check: Start() fails if the port is in use or reserved
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Error "Cannot bind $prefix. The port may be in use or reserved. $($_.Exception.Message)"
    exit 1
}

Write-Host "Server running at http://localhost:8080"

# AWS login hint only. This script never runs aws, prompts for, or accepts credentials.
$awsHome = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.aws'
if (-not ($env:AWS_PROFILE -or $env:AWS_ACCESS_KEY_ID -or $env:AWS_BEARER_TOKEN_BEDROCK -or
          (Test-Path (Join-Path $awsHome 'config')) -or (Test-Path (Join-Path $awsHome 'credentials')))) {
    Write-Host "No AWS credentials found. Log in to AWS (for example 'aws sso login') in your terminal to enable the forecast summary. Serving static files anyway."
}

# Start the summary service with the inherited environment
$summaryProc = $null
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is missing. The forecast summary is unavailable. Serving static files anyway."
} else {
    try {
        $summaryProc = Start-Process node -ArgumentList 'summary-server.mjs' -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
        Start-Sleep -Seconds 2
        if ($summaryProc.HasExited) {
            Write-Host "Summary service failed to start (exit code $($summaryProc.ExitCode)). Serving static files anyway."
            $summaryProc = $null
        }
    } catch {
        Write-Host "Summary service failed to start: $($_.Exception.Message). Serving static files anyway."
        $summaryProc = $null
    }
}

try {
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request  = $context.Request
    $response = $context.Response
    $remote   = $request.RemoteEndPoint.Address.ToString()
    $method   = $request.HttpMethod
    $rawUrl   = $request.Url.AbsolutePath
    $status   = 500

    try {
        foreach ($name in $securityHeaders.Keys) {
            $response.Headers.Add($name, $securityHeaders[$name])
        }

        $proxied = $false
        if ($rawUrl -eq '/api/summary') {
            if ($method -ne 'POST') {
                $status = 405
                $response.Headers.Add('Allow', 'POST')
            } elseif ($request.ContentLength64 -gt 8192) {
                $status = 413
            } else {
                $status = Send-SummaryProxy $request $response
                $proxied = $true
            }
        } elseif ($method -ne 'GET' -and $method -ne 'HEAD') {
            $status = 405
            $response.Headers.Add('Allow', 'GET, HEAD')
        } elseif ($rawUrl -eq '/' -or $rawUrl -eq '/index.html') {
            $filePath    = Join-Path $PSScriptRoot 'index.html'
            $contentType = 'text/html'
        } elseif ($rawUrl -eq '/weather.js') {
            $filePath    = Join-Path $PSScriptRoot 'weather.js'
            $contentType = 'application/javascript'
        } elseif ($rawUrl -eq '/styles.css') {
            $filePath    = Join-Path $PSScriptRoot 'styles.css'
            $contentType = 'text/css'
        } else {
            $status = 404
        }

        if ($proxied) {
            # Response already written by Send-SummaryProxy
        } elseif ($status -eq 500) {
            $content = Get-Content -Raw -Encoding UTF8 -Path $filePath
            $bytes   = [System.Text.Encoding]::UTF8.GetBytes($content)
            $status  = 200
            $response.ContentType = "$contentType; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = $status
            if ($method -ne 'HEAD') {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $response.StatusCode = $status
        }
    } catch {
        $status = 500
        Write-Host ("{0} ERROR {1}" -f (Get-Date -Format 'o'), $_.Exception.Message)
        try { $response.StatusCode = 500 } catch {}
    } finally {
        try { $response.Close() } catch {}
        Write-Log $remote $method $rawUrl $status
    }
}
} finally {
    if ($summaryProc -and -not $summaryProc.HasExited) {
        try { Stop-Process -Id $summaryProc.Id -Force } catch {}
    }
    try { $listener.Close() } catch {}
}
