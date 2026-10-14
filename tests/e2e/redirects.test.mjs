// e2e Pages 模拟器的规范化跳转与 _headers：/index.html → /、/credits.html → /credits，
// /credits 直接服内容，/sw.js 带 Cache-Control: no-cache。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { buildDist, startServer } from "./helpers/env.mjs";

buildDist();

let server;
before(async () => { server = await startServer(); });
after(() => server?.close());

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(server.origin + path, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => resolve({ status: r.statusCode, headers: r.headers, body }));
    }).on("error", reject);
  });
}

test("/index.html 308-redirects to /", async () => {
  const r = await get("/index.html");
  assert.equal(r.status, 308);
  assert.equal(r.headers.location, "/");
});

test("/credits.html 308-redirects to /credits", async () => {
  const r = await get("/credits.html");
  assert.equal(r.status, 308);
  assert.equal(r.headers.location, "/credits");
});

test("/credits serves the credits page", async () => {
  const r = await get("/credits");
  assert.equal(r.status, 200);
  assert.ok(r.body.includes("Richard Sears"), "版权页应带 Richard Sears 署名");
});

test("/sw.js is served no-cache", async () => {
  const r = await get("/sw.js");
  assert.equal(r.status, 200);
  assert.equal(r.headers["cache-control"], "no-cache");
});
