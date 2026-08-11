import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync("components/admin/WebDesignEditor.tsx", "utf8");

test("visual editor Save stores a version without publishing site settings", () => {
  const saveStart = editor.indexOf("async function saveVersion()");
  const publishStart = editor.indexOf("async function applyDesignForTest()");
  assert.ok(saveStart >= 0 && publishStart > saveStart);
  const saveBlock = editor.slice(saveStart, publishStart);
  assert.match(saveBlock, /\/api\/admin\/design-studio\/draft/);
  assert.doesNotMatch(saveBlock, /\/api\/admin\/site-design/);
  assert.doesNotMatch(saveBlock, /\/api\/admin\/design-studio\/apply/);
});

test("visual editor Publish applies without creating a history version", () => {
  const publishStart = editor.indexOf("async function applyDesignForTest()");
  const restoreStart = editor.indexOf("async function restoreVersion(", publishStart);
  assert.ok(publishStart >= 0 && restoreStart > publishStart);
  const publishBlock = editor.slice(publishStart, restoreStart);
  assert.match(publishBlock, /\/api\/admin\/design-studio\/apply/);
  assert.doesNotMatch(publishBlock, /\/api\/admin\/design-studio\/draft/);
});
