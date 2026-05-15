param(
  [int]$Port = 7000,
  [string]$RuleName = "AlRaziqPOS LAN Server"
)

$existing = netsh advfirewall firewall show rule name="$RuleName" 2>$null
if ($LASTEXITCODE -eq 0 -and ($existing | Select-String -SimpleMatch "Rule Name")) {
  Write-Host "OK: Firewall rule already exists: $RuleName"
  exit 0
}

Write-Host "Creating firewall rule '$RuleName' for inbound TCP port $Port..."
netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port profile=any
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to add firewall rule. Try running PowerShell as Administrator."
  exit 1
}

Write-Host "OK: Firewall rule created."

