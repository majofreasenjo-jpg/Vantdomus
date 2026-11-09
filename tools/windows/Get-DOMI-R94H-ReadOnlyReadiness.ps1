<#
.SYNOPSIS
  DOMI R94-H: inspect PC-side local bind safety without changing machine state.
.DESCRIPTION
  READ-ONLY: no certificate, firewall, DNS, ports, services, listeners, files,
  accounts, tokens, network probes, or production data are created or changed.
  Uses Get-NetTCPConnection -State Listen, solely on this Windows PC.

  The optional FixtureJson parameter is for synthetic CI only. Its result is
  unmistakably labeled SYNTHETIC_FIXTURE, never physical certification.

  Even with both 3000/8001 loopback-only, this does NOT show that the listeners
  belong to DOMI, or that TLS/DNS/firewall/phone work. Those stay UNVERIFIED.

  Example (Windows, passive, no admin needed):
    pwsh -NoProfile -File tools/windows/Get-DOMI-R94H-ReadOnlyReadiness.ps1
.PARAMETER FixtureJson
  Synthetic JSON object with listeners array of LocalPort/LocalAddress rows.
  Never provide secrets, hostname, user information or real device evidence.
#>
[CmdletBinding()]
param(
  [string]$FixtureJson = ""
)
$ErrorActionPreference = "Stop"

function Get-R94HPortBindState {
  param([object[]]$Listeners, [int]$Port)
  $matches = @($Listeners | Where-Object { $_.LocalPort -eq $Port })
  if ($matches.Count -eq 0) { return "NOT_LISTENING" }
  foreach ($item in $matches) {
    $address = [string]$item.LocalAddress
    if ($address -cne "127.0.0.1" -and $address -cne "::1") {
      return "NON_LOOPBACK_OR_UNKNOWN"
    }
  }
  return "LOOPBACK_ONLY"
}

function New-R94HReport {
  param(
    [string]$Source,
    [string]$Web,
    [string]$Api,
    [string]$CheckState
  )
  return [ordered]@{
    schema = "DOMI_R94H_PC_BIND_READONLY_V1"
    source = $Source
    status = $CheckState
    web3000 = $Web
    api8001 = $Api
    tlsTrust = "UNVERIFIED"
    privateDns = "UNVERIFIED"
    firewall = "UNVERIFIED"
    physicalPhone = "NOT_RUN"
    listenerIdentityVerified = $false
    noInfrastructureMutation = $true
    canInstall = $false
    canDeploy = $false
    physicalDeviceCertified = $false
  }
}

$source = "LOCAL_WINDOWS_READ_ONLY"
try {
  if ($FixtureJson.Length -gt 0) {
    $source = "SYNTHETIC_FIXTURE"
    if ($FixtureJson.Length -gt 8192) { throw "INVALID_SYNTHETIC_FIXTURE" }
    $fixture = ConvertFrom-Json -InputObject $FixtureJson -ErrorAction Stop
    if ($null -eq $fixture -or $fixture -isnot [pscustomobject] -or
        $fixture.PSObject.Properties.Name -notcontains "listeners" -or
        $fixture.listeners -isnot [array]) {
      throw "INVALID_SYNTHETIC_FIXTURE"
    }
    if (@($fixture.PSObject.Properties.Name).Count -ne 1 -or $fixture.listeners.Count -gt 32) {
      throw "INVALID_SYNTHETIC_FIXTURE"
    }
    $listeners = @()
    foreach ($entry in $fixture.listeners) {
      if ($null -eq $entry -or $entry -isnot [pscustomobject] -or
          @($entry.PSObject.Properties.Name).Count -ne 2 -or
          $entry.PSObject.Properties.Name -notcontains "LocalPort" -or
          $entry.PSObject.Properties.Name -notcontains "LocalAddress" -or
          ($entry.LocalPort -isnot [int] -and $entry.LocalPort -isnot [long]) -or
          $entry.LocalAddress -isnot [string] -or
          $entry.LocalAddress.Length -gt 50 -or
          $entry.LocalPort -lt 1 -or $entry.LocalPort -gt 65535) {
        throw "INVALID_SYNTHETIC_FIXTURE"
      }
      $listeners += [pscustomobject]@{
        LocalPort = $entry.LocalPort
        LocalAddress = $entry.LocalAddress
      }
    }
  } else {
    if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
      throw "WINDOWS_REQUIRED"
    }
    # Get-NetTCPConnection is read-only. It does not contact any remote host.
    $listeners = @(
      Get-NetTCPConnection -State Listen -ErrorAction Stop |
      Where-Object { $_.LocalPort -eq 3000 -or $_.LocalPort -eq 8001 } |
      ForEach-Object {
        [pscustomobject]@{
          LocalPort = [int]$_.LocalPort
          LocalAddress = [string]$_.LocalAddress
        }
      }
    )
  }

  $web = Get-R94HPortBindState -Listeners $listeners -Port 3000
  $api = Get-R94HPortBindState -Listeners $listeners -Port 8001
  if ($web -eq "NON_LOOPBACK_OR_UNKNOWN" -or $api -eq "NON_LOOPBACK_OR_UNKNOWN") {
    $status = "LOCAL_BIND_EXPOSURE_REQUIRES_REVIEW"
    $exitCode = 3
  } elseif ($web -ne "LOOPBACK_ONLY" -or $api -ne "LOOPBACK_ONLY") {
    $status = "LOCAL_SERVICES_NOT_OBSERVED"
    $exitCode = 2
  } else {
    $status = "LOCAL_BIND_ONLY_OBSERVED"
    $exitCode = 0
  }
  $report = New-R94HReport -Source $source -Web $web -Api $api -CheckState $status
} catch {
  # Deliberately suppress errors and machine details (no file paths or IP data).
  $report = New-R94HReport -Source $source -Web "UNVERIFIED" -Api "UNVERIFIED" -CheckState "INSPECTION_UNAVAILABLE"
  $exitCode = 4
}

Write-Output ($report | ConvertTo-Json -Depth 4 -Compress)
exit $exitCode
