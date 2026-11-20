# Sets the Bedrock settings for this process only, then starts the server.
# Edit the values below if you change model, Region, or AWS profile.
$env:BEDROCK_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
$env:AWS_REGION       = 'us-west-2'
if (-not $env:AWS_PROFILE) { $env:AWS_PROFILE = 'jksandbox' }
& (Join-Path $PSScriptRoot 'start-server.ps1')
