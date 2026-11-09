import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../windows/Get-DOMI-R94H-ReadOnlyReadiness.ps1", import.meta.url));
const source = readFileSync(script, "utf8");

function run(listeners) {
  const fixture = JSON.stringify({ listeners });
  const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-File", script, "-FixtureJson", fixture], {
    encoding: "utf8", timeout: 12000, env: { ...process.env, POWERSHELL_TELEMETRY_OPTOUT: "1" },
  });
  assert.ifError(result.error);
  const lines = (result.stdout || "").trim().split(/\r?\n/);
  assert.equal(lines.length, 1, "Report must contain exactly one structured record");
  const report = JSON.parse(lines[0]);
  assert.equal(report.schema, "DOMI_R94H_PC_BIND_READONLY_V1");
  assert.equal(report.source, "SYNTHETIC_FIXTURE");
  assert.equal(report.noInfrastructureMutation, true);
  assert.equal(report.canInstall, false);
  assert.equal(report.canDeploy, false);
  assert.equal(report.physicalDeviceCertified, false);
  assert.equal(report.listenerIdentityVerified, false);
  for (const field of ["tlsTrust", "privateDns", "firewall"]) assert.equal(report[field], "UNVERIFIED");
  assert.equal(report.physicalPhone, "NOT_RUN");
  assert.doesNotMatch(result.stdout + result.stderr, /203\.0\.113\.7|password|private key/i);
  return { report, exit: result.status };
}

test("R94-H code is restricted to passive read, no mutations or network probes", () => {
  assert.match(source, /Get-NetTCPConnection -State Listen/);
  for (const forbidden of [
    /\bNew-NetFirewallRule\b/, /\bSet-NetFirewallRule\b/,
    /\bnetsh\b/, /\bNew-SelfSignedCertificate\b/, /\bImport-Certificate\b/,
    /\bStart-Process\b/, /\bStart-Service\b/, /\bInvoke-WebRequest\b/,
    /\bTest-NetConnection\b/, /\bResolve-DnsName\b/, /\bNew-Item\b/,
    /\bSet-Content\b/, /\bOut-File\b/,
  ]) {
    assert.doesNotMatch(source.replace(/<#[\s\S]*?#>/g, ""), forbidden);
  }
});

test("R94-H accepts only both listeners confined to loopback", () => {
  const { report, exit } = run([
    { LocalPort: 3000, LocalAddress: "127.0.0.1" },
    { LocalPort: 8001, LocalAddress: "::1" },
  ]);
  assert.equal(exit, 0);
  assert.equal(report.status, "LOCAL_BIND_ONLY_OBSERVED");
  assert.equal(report.web3000, "LOOPBACK_ONLY");
  assert.equal(report.api8001, "LOOPBACK_ONLY");
});

test("R94-H refuses publicly bound API even if another instance is loopback", () => {
  const { report, exit } = run([
    { LocalPort: 3000, LocalAddress: "127.0.0.1" },
    { LocalPort: 8001, LocalAddress: "127.0.0.1" },
    { LocalPort: 8001, LocalAddress: "0.0.0.0" },
  ]);
  assert.equal(exit, 3);
  assert.equal(report.status, "LOCAL_BIND_EXPOSURE_REQUIRES_REVIEW");
  assert.equal(report.api8001, "NON_LOOPBACK_OR_UNKNOWN");
});

test("R94-H fails closed for any external, wildcard or ambiguous listener", () => {
  for (const address of ["::", "192.168.1.20", "203.0.113.7", "unknown", ""]) {
    const { report, exit } = run([
      { LocalPort: 3000, LocalAddress: "127.0.0.1" },
      { LocalPort: 8001, LocalAddress: address },
    ]);
    assert.equal(exit, 3, address);
    assert.equal(report.status, "LOCAL_BIND_EXPOSURE_REQUIRES_REVIEW");
  }
});

test("R94-H distinguishes missing listener from unsafe listeners", () => {
  const { report, exit } = run([{ LocalPort: 3000, LocalAddress: "127.0.0.1" }]);
  assert.equal(exit, 2);
  assert.equal(report.web3000, "LOOPBACK_ONLY");
  assert.equal(report.api8001, "NOT_LISTENING");
  assert.equal(report.status, "LOCAL_SERVICES_NOT_OBSERVED");
});

test("R94-H rejects malformed fixtures without printing fixture input", () => {
  const result = spawnSync("pwsh", [
    "-NoProfile", "-NonInteractive", "-File", script,
    "-FixtureJson", '{"listeners":[{"LocalPort":8001,"LocalAddress":"203.0.113.7","secret":"password"}]}',
  ], { encoding: "utf8", timeout: 12000 });
  assert.ifError(result.error);
  assert.equal(result.status, 4);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.status, "INSPECTION_UNAVAILABLE");
  assert.equal(report.physicalDeviceCertified, false);
  assert.doesNotMatch(result.stdout + result.stderr, /203\.0\.113\.7|password/);
});
