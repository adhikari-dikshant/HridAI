#Requires -Version 7
# Runs the full flow against a running server. Mock quality accepts any non-empty file.
# Usage: ./scripts/smoke_test.ps1 -BaseUrl http://localhost:8000 -Token dev:smoke
param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$Token = "dev:smoke"
)

$ErrorActionPreference = "Stop"
$headers = @{ Authorization = "Bearer $Token" }
$audio = New-TemporaryFile
$audioPath = "$($audio.FullName).m4a"
Move-Item $audio.FullName $audioPath
[IO.File]::WriteAllBytes($audioPath, [byte[]](1..255))

function Assert-Equal($actual, $expected, $what) {
    if ($actual -ne $expected) { throw "$what`: expected '$expected', got '$actual'" }
    Write-Host "ok  $what"
}

function Send-Recording($screeningId, $location, $durationMs) {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/screenings/$screeningId/recordings" `
        -Headers $headers -Form @{
            file        = Get-Item $audioPath
            location    = $location
            source      = "phone_mic"
            duration_ms = $durationMs
            platform    = "android"
        }
}

try {
    $health = Invoke-RestMethod "$BaseUrl/healthz"
    Assert-Equal $health.status "ok" "health"

    $body = @{
        language = "hi"
        consent  = @{ accepted = $true; version = "v1" }
        patient  = @{ age_years = 34; sex = "male"; symptoms = @("breathlessness") }
    } | ConvertTo-Json -Depth 4
    $created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/screenings" -Headers $headers `
        -ContentType "application/json" -Body $body
    $id = $created.screening_id
    Assert-Equal $created.status "awaiting_recordings" "create screening"

    Assert-Equal (Send-Recording $id "MV" 5000).accepted $false "short recording rejected"
    Assert-Equal (Send-Recording $id "MV" 15000).accepted $true "MV accepted"
    Assert-Equal (Send-Recording $id "AV" 15000).screening_status "ready" "AV accepted"

    $analysis = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/screenings/$id/analyze" -Headers $headers
    Assert-Equal $analysis.status "completed" "analyze"
    Write-Host "    label=$($analysis.result.label) confidence=$($analysis.result.confidence)"

    $list = Invoke-RestMethod -Uri "$BaseUrl/v1/screenings" -Headers $headers
    Assert-Equal ($list.items.screening_id -contains $id) $true "history lists screening"

    Invoke-RestMethod -Method Delete -Uri "$BaseUrl/v1/screenings/$id" -Headers $headers | Out-Null
    $status = (Invoke-WebRequest -Uri "$BaseUrl/v1/screenings/$id" -Headers $headers `
        -SkipHttpErrorCheck).StatusCode
    Assert-Equal $status 404 "deleted screening is gone"

    Write-Host "Smoke test passed"
}
finally {
    Remove-Item $audioPath -ErrorAction SilentlyContinue
}
