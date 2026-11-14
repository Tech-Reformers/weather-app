# Local static server for the weather app.
# Logs one line per request to stdout (timestamp, client, method, path, status).

$prefix = 'http://localhost:8080/'

# Security headers sent with every response
$csp = "default-src 'self'; script-src 'self'; style-src 'self'; " +
       "connect-src https://nominatim.openstreetmap.org https://api.weather.gov; " +
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

        if ($method -ne 'GET' -and $method -ne 'HEAD') {
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

        if ($status -eq 500) {
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
