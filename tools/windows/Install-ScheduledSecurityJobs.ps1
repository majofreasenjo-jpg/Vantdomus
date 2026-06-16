param(
  [string]$ProjectRoot = "D:\Aplicaciones de Juegos\VantDomus_Improved",
  [string]$PythonPath = "C:\Users\casa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  [string]$BackupDir = "C:\VantDomus\backups",
  [string]$OffsiteBackupDir = "C:\VantDomus\offsite-backups",
  [string]$LogDir = "C:\VantDomus\logs",
  [string]$TaskPrefix = "VantDomus"
)

$ErrorActionPreference = "Stop"

function Assert-PathExists {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Register-VantDomusTask {
  param(
    [string]$Name,
    [string]$Arguments,
    [Microsoft.Management.Infrastructure.CimInstance]$Trigger,
    [string]$Description
  )

  $taskName = "$TaskPrefix-$Name"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location -LiteralPath '$ProjectRoot'; & '$PythonPath' $Arguments *> '$LogDir\$taskName.log'`""
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $Trigger -Settings $settings -Description $Description -Force | Out-Null
  Write-Host "Registered $taskName"
}

Assert-PathExists -Path $ProjectRoot -Label "Project root"
Assert-PathExists -Path $PythonPath -Label "Python runtime"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $OffsiteBackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$dailyAt0200 = New-ScheduledTaskTrigger -Daily -At 2:00am
$dailyAt0300 = New-ScheduledTaskTrigger -Daily -At 3:00am
$dailyAt0400 = New-ScheduledTaskTrigger -Daily -At 4:00am
$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)

Register-VantDomusTask `
  -Name "ClamAV-Healthcheck" `
  -Arguments "apps\api\scripts\clamav_healthcheck.py" `
  -Trigger $hourly `
  -Description "Checks ClamAV daemon health and records security_events on failure."

Register-VantDomusTask `
  -Name "Encrypted-Backup-Drill" `
  -Arguments "apps\api\scripts\backup_restore_drill.py --backup-dir '$BackupDir' --encrypt --offsite-dir '$OffsiteBackupDir'" `
  -Trigger $dailyAt0200 `
  -Description "Creates an encrypted backup and verifies restore integrity."

Register-VantDomusTask `
  -Name "Security-Event-Integrity" `
  -Arguments "apps\api\scripts\verify_security_events.py" `
  -Trigger $dailyAt0300 `
  -Description "Verifies tamper-evident security event hash chains."

Register-VantDomusTask `
  -Name "Retention-Cleanup-DryRun" `
  -Arguments "apps\api\scripts\retention_cleanup.py --grace-days 30" `
  -Trigger $dailyAt0400 `
  -Description "Dry-runs cleanup of expired temporary security records."

Register-VantDomusTask `
  -Name "Production-Preflight" `
  -Arguments "apps\api\scripts\production_preflight.py --backup-dir '$BackupDir'" `
  -Trigger $dailyAt0300 `
  -Description "Runs production readiness checks for runtime, DB, Redis, ClamAV and backups."

Write-Host "VantDomus scheduled security jobs installed."
Write-Host "Logs: $LogDir"
