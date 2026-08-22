# FXC Admin Key Setup Script (Windows)
# Run this after starting the backend server with: npm run dev

$secretKey = "fsdkfjsaldfjljj@(@&$!(48420ufasnda,ancsdlfj**2918300pubgetdfxckhdksij13lfkhushadixyzdeepchartchutiyabhaangbhoasxyz23091kjlad"
$backendUrl = "http://localhost:5000"

Write-Host "🔐 Setting up FXC Admin Key..." -ForegroundColor Cyan
Write-Host ""

try {
    $body = @{
        secretKey = $secretKey
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$backendUrl/api/init/setup" `
      -Method Post `
      -Headers @{"Content-Type"="application/json"} `
      -Body $body `
      -TimeoutSec 10

    Write-Host "✅ Setup successful!" -ForegroundColor Green
    Write-Host $response.Content
    Write-Host ""
    Write-Host "✅ Your secret key is now stored in MongoDB"
    Write-Host ""
    Write-Host "Next: Open http://localhost:5173" -ForegroundColor Yellow
    Write-Host "Click 'Admin' button and paste your secret key"
}
catch {
    Write-Host "❌ Setup failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure backend is running: npm run dev"
    Write-Host "2. Check MongoDB is connected (should show in backend logs)"
    Write-Host "3. Make sure .env file has MONGODB_URI set correctly"
}

