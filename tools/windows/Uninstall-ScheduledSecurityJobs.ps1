param(
  [string]$TaskPrefix = "VantDomus"
)

$ErrorActionPreference = "Stop"

$names = @(
  "$TaskPrefix-ClamAV-Healthcheck",
  "$TaskPrefix-Encrypted-Backup-Drill",
  "$TaskPrefix-Security-Event-Integrity",
  "$TaskPrefix-Retention-Cleanup-DryRun",
  "$TaskPrefix-Production-Preflight"
)

foreach ($name in $names) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "Removed $name"
  } else {
    Write-Host "Not found $name"
  }
}

Write-Host "VantDomus scheduled security jobs removed."
