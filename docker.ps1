# PowerShell script for Windows development environment
param(
    [switch]$d
)

# Change to the Docker directory where the compose files are located
Set-Location -Path "Docker" -ErrorAction Stop

Write-Host "Starting Development Environment..." -ForegroundColor Green

# Stop any existing containers to free up ports
docker compose -f docker-compose.yml down 2>$null

# Clean up any lingering containers by name
docker rm -f aeroar-app 2>$null

# Build the docker compose command
$composeArgs = @("compose", "--env-file", "../.env", "-f", "docker-compose.yml", "up", "--build")

# Add -d flag if specified
if ($d) {
    $composeArgs += "-d"
    Write-Host "Running in detached mode..." -ForegroundColor Yellow
}

# Start the development environment
& docker $composeArgs

if ($d) {
    Write-Host "Development environment started successfully!" -ForegroundColor Green
    Write-Host "Access your application at: http://localhost:PORT" -ForegroundColor Cyan
}
