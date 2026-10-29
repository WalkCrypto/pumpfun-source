import assert from "node:assert/strict";
import { request } from "node:http";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { hasAmbiguousApiCredentials } from "../src/api-key-gate.js";

// Synthetic format samples only; these are not issued or verified credentials.
const key = `pf_live_${"A".repeat(49)}`;
const other = `pf_live_${"B".repeat(49)}`;
const expected = {
  statusCode: 501,
  error: "COMPATIBILITY_NOT_IMPLEMENTED",
  reason: "API_CREDENTIAL_AMBIGUITY_UNQUALIFIED",
};

test("credential arrays and raw duplicate fields are ambiguous before normalization", () => {
  for (const headers of [
    { authorization: [`Bearer ${key}`] },
    { "x-api-key": [key] },
    { authorization: [] },
    { "x-api-key": [] },
  ]) {
    assert.equal(hasAmbiguousApiCredentials({ headers }), true);
  }
  for (const name of ["Authorization", "X-API-Key"]) {
    assert.equal(hasAmbiguousApiCredentials({
      headers: { [name.toLowerCase()]: key },
      raw: { rawHeaders: [name, key, name.toLowerCase(), other] },
    }), true);
  }
  assert.equal(hasAmbiguousApiCredentials({ headers: {} }), false);
  assert.equal(hasAmbiguousApiCredentials({ headers: { authorization: `Bearer ${key}` } }), false);
  assert.equal(hasAmbiguousApiCredentials({
    headers: { "x-api-key": key },
    raw: { rawHeaders: ["Host", "localhost", "X-API-Key", key] },
  }), false);
});

test("identical, conflicting and malformed dual sources cannot enter native or fixture handlers", async (t) => {
  const app = buildApp([{
    method: "GET", path: "/v1/pnl-leaderboard", body: { mustNotReplay: true },
    source: "synthetic:auth-boundary", status: 200,
  }]);
  t.after(() => app.close());
  for (const url of ["/v1/users", "/v1/pnl-leaderboard"]) {
    for (const authorization of [`Bearer ${key}`, `Bearer ${other}`, "Basic sample", ""]) {
      const response = await app.inject({ url, headers: { authorization, "x-api-key": key } });
      assert.equal(response.statusCode, 501);
      assert.deepEqual(response.json(), expected);
      assert.doesNotMatch(response.body, /pf_live_|mustNotReplay|sample|Bearer/);
    }
  }
});

test("real HTTP duplicate credentials fail closed even when Node discards Authorization duplicates", async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  for (const name of ["Authorization", "X-API-Key"]) {
    for (const duplicate of [key, other]) {
      const prefix = name === "Authorization" ? "Bearer " : "";
      const result = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
        const req = request({
          host: "127.0.0.1", port: address.port, path: "/v1/users",
          headers: ["Host", "127.0.0.1", name, prefix + key, name.toLowerCase(), prefix + duplicate],
        }, (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode, body }));
        });
        req.on("error", reject);
        req.end();
      });
      assert.equal(result.status, 501);
      assert.deepEqual(JSON.parse(result.body), expected);
      assert.doesNotMatch(result.body, /pf_live_|Bearer/);
    }
  }
});

test("single-source credential behavior and non-developer routes remain unchanged", async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  for (const headers of [
    { authorization: `Bearer ${key}` },
    { authorization: `  bEaReR\t${key}  ` },
    { "X-API-KEY": key },
  ]) {
    const response = await app.inject({ url: "/v1/users", headers });
    assert.equal(response.statusCode, 200);
  }
  for (const [headers, error] of [
    [{}, "API_KEY_REQUIRED"],
    [{ authorization: "Basic sample" }, "API_KEY_REQUIRED"],
    [{ authorization: "Bearer malformed" }, "API_KEY_INVALID"],
    [{ "x-api-key": ` ${key} ` }, "API_KEY_INVALID"],
  ] as const) {
    const response = await app.inject({ url: "/v1/users?key=redacted", headers });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, error);
    assert.equal(response.json().path, "/users");
    assert.doesNotMatch(response.body, /pf_live_|redacted|malformed(?=\")/);
  }
  for (const url of ["/health", "/__reconstruction/status"]) {
    const response = await app.inject({ url, headers: { authorization: key, "x-api-key": other } });
    assert.equal(response.statusCode, 200);
  }
  const head = await app.inject({ method: "HEAD", url: "/v1/users", headers: { authorization: key, "x-api-key": other } });
  assert.equal(head.statusCode, 501);
  assert.equal(head.body, "");
});
