# Check if port 8080 is already in use
try {
    $client = New-Object System.Net.Sockets.TcpClient('localhost', 8080)
    $client.Close()
    Write-Error "Port 8080 is already in use. Please free the port and try again."
    exit 1
} catch {
    # Port is free — continue
}

# Start the HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()

Write-Host "Server running at http://localhost:8080"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request  = $context.Request
    $response = $context.Response

    $rawUrl = $request.Url.AbsolutePath

    if ($rawUrl -eq '/' -or $rawUrl -eq '/index.html') {
        $filePath   = Join-Path $PSScriptRoot 'index.html'
        $contentType = 'text/html'
    } elseif ($rawUrl -eq '/weather.js') {
        $filePath   = Join-Path $PSScriptRoot 'weather.js'
        $contentType = 'application/javascript'
    } else {
        $response.StatusCode = 404
        $response.Close()
        continue
    }

    $content = Get-Content -Raw -Encoding UTF8 -Path $filePath
    $bytes   = [System.Text.Encoding]::UTF8.GetBytes($content)

    $response.StatusCode  = 200
    $response.ContentType = "$contentType; charset=utf-8"
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
}
