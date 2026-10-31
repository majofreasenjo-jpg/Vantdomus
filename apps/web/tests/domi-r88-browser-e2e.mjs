/**
 * DOMI R88: real browser -> Next.js -> FastAPI -> disposable SQLite.
 * Synthetic-only. No external AI, cloud database, user data or production.
 *
 * A browser test in GitHub's Linux runner is NOT a field test on a phone.
 * It verifies a browser, a second mobile-sized browser context, a real HTTP
 * proxy, durable data, and an independent backend-process restart.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const apiBase = "http://127.0.0.1:8001";
const webDir = process.cwd();
const apiDir = path.resolve(webDir, "../api");
const scratch = mkdtempSync(path.join(tmpdir(), "domi-r88-fictional-"));
const dbPath = path.join(scratch, "fictional-family.sqlite");
const env = {
  ...process.env,
  NODE_ENV: "development",
  APP_ENV: "local",
  VERCEL_ENV: "",
  VANTDOMUS_SKIP_LOCAL_ENV: "1",
  DB_PATH: dbPath,
  DATABASE_URL: "",
  JWT_SECRET: "r88-fixture-only-long-random-looking-jwt-not-for-real-use",
  VANTDOMUS_MFA_SECRET_KEY: "r88-fixture-only-mfa-token-not-for-real-use",
  VANTDOMUS_ALLOWED_HOSTS: "127.0.0.1,localhost",
  CORS_ALLOWED_ORIGINS: base + ",http://localhost:3000",
  VANTDOMUS_APP_PUBLIC_URL: base,
  VANTDOMUS_PUBLIC_REGISTRATION: "true",
  VANTDOMUS_ALLOW_DEMO_SEED: "false",
  VANTDOMUS_API_RATE_LIMIT_MODE: "memory",
  VANTDOMUS_BACKEND_INSTANCES: "1",
  VANTDOMUS_ENABLE_PUBLIC_UPLOADS: "false",
  ASSISTANT_PROVIDER_MODE: "mock",
  ASSISTANT_REAL_PROVIDER_ENABLED: "false",
  ASSISTANT_SHADOW_MODE: "false",
  ASSISTANT_EXTERNAL_CALLS_ALLOWED: "false",
  VANTDOMUS_AI_FEATURES_ENABLED: "false",
  OPENAI_API_KEY: "",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "",
  NEXT_PUBLIC_API_BASE: apiBase,
  NEXT_PUBLIC_ACCESS_TOKEN: "",
};
const logs = new Map();
let api = null;
let web = null;
let browser = null;

function start(label, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  logs.set(label, "");
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", chunk => {
      const previous = logs.get(label) || "";
      logs.set(label, (previous + String(chunk)).slice(-16000));
    });
  }
  child.on("error", error => {
    logs.set(label, (logs.get(label) || "") + "\nPROCESS_ERROR:" + error.message);
  });
  return child;
}

function stop(child) {
  if (!child || !child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch {}
  }
}

async function waitFor(url, predicate, label, maxMs = 130000) {
  const deadline = Date.now() + maxMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {cache:"no-store",signal:AbortSignal.timeout(3500)});
      last = "HTTP " + res.status;
      if (await predicate(res)) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(900);
  }
  throw new Error(label + " not ready: " + last);
}

async function browserProxy(page, method, endpoint, payload) {
  return await page.evaluate(async ({method, endpoint, payload}) => {
    const headers = {};
    if (method !== "GET") {
      const cookie = document.cookie.split(";").map(x => x.trim())
        .find(x => x.startsWith("vantdomus_csrf="));
      const csrf = cookie ? decodeURIComponent(cookie.substring("vantdomus_csrf=".length)) : "";
      headers["Content-Type"] = "application/json";
      headers["X-VantDomus-CSRF"] = csrf;
    }
    const response = await fetch("/api/proxy" + endpoint, {
      method, headers, credentials:"same-origin", cache:"no-store",
      body:payload === undefined ? undefined : JSON.stringify(payload),
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    return {status:response.status,body};
  }, {method, endpoint, payload});
}

function homeIdFromUrl(url) {
  const pathname = new URL(url).pathname;
  const found = pathname.match(/^\/hogar\/([0-9a-f-]{36})$/);
  assert.ok(found, "Expected a real home page URL, got: " + pathname);
  return found[1];
}

async function apiJson(endpoint, method, body, token) {
  const headers = {"Content-Type":"application/json"};
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(apiBase + endpoint, {
    method,headers,cache:"no-store",
    body:body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json;
  try { json=await r.json(); } catch { json=null; }
  return {status:r.status,body:json};
}

async function run() {
  api = start("FastAPI", "python", [
    "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8001",
  ],apiDir);
  await waitFor(apiBase + "/health", async r => {
    if (!r.ok) return false;
    const body = await r.json();
    return body.ok === true && body.service === "vantdomus-core";
  },"FastAPI health",120000);

  web = start("Next.js","npm",[
    "run","dev","--","--hostname","127.0.0.1","--port","3000",
  ],webDir);
  await waitFor(base + "/local-first-run",async r => {
    if (!r.ok) return false;
    return (await r.text()).includes("Primer ingreso local");
  },"Next.js fictional first-run",180000);

  browser = await chromium.launch({headless:true});
  const desktop = await browser.newContext({viewport:{width:1280,height:800}});
  const page = await desktop.newPage();

  await page.goto(base + "/local-first-run",{waitUntil:"domcontentloaded",timeout:100000});
  await page.locator('input[name="alias"]').fill("alexa-fict");
  await page.locator('input[name="password"]').fill("Only#Fictional-Zebra2026");
  await page.locator('input[name="fictional"]').check();
  await page.getByRole("button",{name:"Crear hogar ficticio local"}).click();
  await page.waitForURL(/\/hogar\/[0-9a-f-]{36}(?:\?.*)?$/,{timeout:60000});
  const hid = homeIdFromUrl(page.url());
  const cookies = await desktop.cookies(base);
  assert.ok(cookies.some(x=>x.name==="vantdomus_access_token" && x.httpOnly));
  assert.ok(cookies.some(x=>x.name==="vantdomus_csrf" && !x.httpOnly));

  const memoryText = "Ensayo R88: libro ficticio preferido de alexa";
  const createMemory = await browserProxy(page,"POST","/assistant/memory",{
    household_id:hid, memory_type:"preference",content:memoryText,
    visibility_scope:"household_shared",
  });
  assert.equal(createMemory.status,200,
    "Browser Next.js proxy failed to create memory: " + JSON.stringify(createMemory.body));
  const memoryId = createMemory.body?.id;
  assert.ok(memoryId,"Backend did not return persistent memory id");

  const remembered = await browserProxy(page,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.equal(remembered.status,200);
  assert.ok(remembered.body?.items?.some(x=>x.id===memoryId && x.content===memoryText));
  console.log("R88 PASS: local browser account, household, HTTP auth+CSRF proxy and memory write/read");

  // R90: use the actual UI, not a direct HTTP helper, to teach DOMI.
  await page.goto(base + "/hogar/" + hid, {waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Más ▾"}).click();
  await page.getByRole("link",{name:"Memoria y perfiles de la familia"}).click();
  await page.waitForURL(/\/perfiles\/[0-9a-f-]{36}/);
  await page.getByPlaceholder("Escríbelo en tus palabras…").fill("R90 recuerdo familiar inventado");
  await page.getByRole("button",{name:"Enseñar a Domi"}).click();
  const memoryRow = page.locator(".card").getByText("R90 recuerdo familiar inventado",{exact:true}).first();
  await memoryRow.waitFor({timeout:25000});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByText("R90 recuerdo familiar inventado",{exact:true}).first().waitFor({timeout:25000});
  // R91: correct through the existing library UI, then reload from DB.
  const libraryRow=page.locator(".row").filter({has:page.locator("span").getByText("R90 recuerdo familiar inventado",{exact:true})}).first();
  await libraryRow.getByRole("button",{name:"Corregir"}).click();
  await libraryRow.getByRole("textbox",{name:"Corregir memoria"}).fill("R91 recuerdo familiar corregido");
  await libraryRow.getByRole("button",{name:"Guardar"}).click();
  await page.getByText("R91 recuerdo familiar corregido",{exact:true}).first().waitFor({timeout:25000});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.getByText("R91 recuerdo familiar corregido",{exact:true}).first().waitFor({timeout:25000});
  const corrected=await browserProxy(page,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.ok(corrected.body?.items?.some(x=>x.content==="R91 recuerdo familiar corregido"));
  const correctedId=corrected.body.items.find(x=>x.content==="R91 recuerdo familiar corregido").id;
  page.once("dialog",d=>d.accept());
  const editorRow=page.locator("div").filter({has:page.getByText("R91 recuerdo familiar corregido",{exact:true})}).filter({has:page.getByRole("button",{name:"Olvidar"})}).last();
  await editorRow.getByRole("button",{name:"Olvidar"}).click();
  const forgotten=await browserProxy(page,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.equal(forgotten.status,200);
  assert.ok(!forgotten.body?.items?.some(x=>x.id===correctedId));
  console.log("R91 PASS: correction and authorized soft deletion via DOMI UI");
  console.log("R90 PASS: teaching and reloading persistent memory from the actual DOMI UI");


  // A genuinely fresh backend operating-system process must reconstruct state
  // from the same SQLite file; the browser is left running.
  stop(api);
  await waitFor(apiBase + "/health", r => Promise.resolve(!r.ok), "API shutdown", 4000)
    .catch(()=>{}); // TCP failure is expected when the old process exits.
  await delay(1300);
  api = start("FastAPI-restart", "python", [
    "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8001",
  ],apiDir);
  await waitFor(apiBase + "/health", async r => {
    if (!r.ok) return false;
    const json=await r.json();
    return json.ok===true && json.service==="vantdomus-core";
  },"FastAPI cold restart",120000);

  const afterRestart=await browserProxy(page,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.equal(afterRestart.status,200,"Previous session lost authorized access after process restart");
  assert.ok(afterRestart.body?.items?.some(x=>x.id===memoryId && x.content===memoryText));
  console.log("R88 PASS: cold backend restart and persistent readback via browser");

  // A fresh independent browser context, shaped like a phone, must log in
  // again and retrieve the exact same memory from the shared backend.
  const mobile=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  });
  const mobilePage=await mobile.newPage();
  await mobilePage.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await mobilePage.locator('input[name="email"]').fill("alexa-fict@example.invalid");
  await mobilePage.locator('input[name="password"]').fill("Only#Fictional-Zebra2026");
  await mobilePage.getByRole("button",{name:"Entrar",exact:true}).click();
  await mobilePage.waitForURL(/\/hogar\/[0-9a-f-]{36}(?:\?.*)?$/,{timeout:60000});
  assert.equal(homeIdFromUrl(mobilePage.url()),hid);
  const mobileRead=await browserProxy(mobilePage,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.equal(mobileRead.status,200);
  assert.ok(mobileRead.body?.items?.some(x=>x.id===memoryId));
  console.log("R88 PASS: new mobile-sized browser context, fresh login and identical memory");

  // Browser without a valid session must not obtain the memory via the web.
  const guest=await browser.newContext();
  const guestPage=await guest.newPage();
  await guestPage.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  const guestRead=await browserProxy(guestPage,"GET","/assistant/memory?household_id="+encodeURIComponent(hid));
  assert.equal(guestRead.status,401);
  console.log("R88 PASS: anonymous browser cannot reach household memory");

  // Independent fictitious household must be denied cross-tenant read.
  const otherEmail="r88-other@example.invalid";
  const otherPassword="Another#Fictional-Zebra2026";
  const registered=await apiJson("/auth/register","POST",{email:otherEmail,password:otherPassword});
  assert.equal(registered.status,200);
  const otherSession=await apiJson("/auth/login","POST",{email:otherEmail,password:otherPassword});
  assert.equal(otherSession.status,200);
  const otherToken=otherSession.body?.access_token;
  assert.ok(otherToken);
  const otherHome=await apiJson("/households?name=Other%20fictional%20home","POST",undefined,otherToken);
  assert.equal(otherHome.status,200);
  const forbidden=await apiJson(
    "/assistant/memory?household_id="+encodeURIComponent(hid),
    "GET",undefined,otherToken,
  );
  assert.equal(forbidden.status,403);
  console.log("R88 PASS: cross-household memory read is rejected");

  console.log("R88 BROWSER E2E: PASS (synthetic local only; simulated mobile viewport is NOT a real phone)");
}

try {
  await run();
} catch(error) {
  console.error("R88 BROWSER E2E: FAIL");
  console.error(error instanceof Error ? error.stack : String(error));
  for (const [label,log] of logs) console.error("LAST LOG " + label + "\n" + log.slice(-4500));
  process.exitCode=1;
} finally {
  try { await browser?.close(); } catch {}
  stop(web);
  stop(api);
  await delay(400);
  try { rmSync(scratch,{recursive:true,force:true}); } catch {}
}
