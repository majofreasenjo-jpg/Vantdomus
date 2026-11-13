import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const login = read("../app/login/page.tsx");
const request = read("../app/recuperar-acceso/RecoveryRequestClient.tsx");
const page = read("../app/recuperar-acceso/page.tsx");
const confirmation = read("../app/reset-password/ResetPasswordClient.tsx");
const api = read("../lib/public-api.ts");
const proxy = read("../app/api/public/[...path]/route.ts");

test("login offers a request page, while token confirmation is preserved", () => {
  assert.match(login, /href="\\/recuperar-acceso"/);
  assert.doesNotMatch(login, /href="\\/reset-password"/);
  assert.match(page, /<RecoveryRequestClient/);
  assert.match(confirmation, /confirmPasswordReset\\(token, password\\)/);
});

test("request uses existing JSON public proxy with no URL credentials", () => {
  assert.match(request, /requestPasswordReset\\(email\\.trim\\(\\)\\)/);
  assert.match(api, /publicApiFetch\\(`\\/auth\\/password\\/reset\\/request`/);
  assert.match(api, /JSON\\.stringify\\(\\{ email \\}\\)/);
  assert.match(proxy, /"auth\\/password\\/reset\\/request"/);
});

test("no account enumeration or automatic email sending", () => {
  assert.match(request, /onSubmit=\\{onSubmit\\}/);
  assert.match(request, /Si existe una cuenta autorizada/);
  assert.doesNotMatch(request, /email_delivery|\\.token|raw_token/);
  assert.match(request, /No fue posible procesar la solicitud/);
});
