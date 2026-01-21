# Test script for booking reminders
# Run with: .\scripts\test-reminders.ps1

$baseUrl = "http://localhost:3000"
$secret = "test-secret-123"

Write-Host "Testing Booking Reminders API" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Health check
Write-Host "`n1. Health Check:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/cron/booking-reminders" -Method GET -Headers @{
        'Authorization' = "Bearer $secret"
    }
    $health | ConvertTo-Json
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Process reminders
Write-Host "`n2. Process Reminders:" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/api/cron/booking-reminders" -Method POST -Headers @{
        'Authorization' = "Bearer $secret"
    }
    $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.ReadToEnd()
    }
}

Write-Host "`nDone!" -ForegroundColor Green
