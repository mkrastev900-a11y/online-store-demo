import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("storefront shell avoids duplicate client site-design fetches", () => {
  const header = readFileSync("components/Header.tsx", "utf8");
  const footer = readFileSync("components/Footer.tsx", "utf8");

  assert.doesNotMatch(header, /fetch\(["']\/api\/site-design/);
  assert.doesNotMatch(footer, /fetch\(["']\/api\/site-design/);
});

test("admin navigation alert polling sleeps instead of running a fixed background interval", () => {
  const source = readFileSync("components/admin/AdminNav.tsx", "utf8");

  assert.doesNotMatch(source, /setInterval\(\s*refreshAlerts\s*,\s*5_000/);
  assert.match(source, /document\.visibilityState === "hidden"/);
  assert.match(source, /clearRefreshTimer\(\)/);
  assert.ok(
    source.includes("refreshTimer = window.setTimeout(() => {") &&
      source.includes("void refreshAlerts();") &&
      source.includes("}, 5_000);"),
  );
});
