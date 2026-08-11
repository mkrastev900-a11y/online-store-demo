import assert from "node:assert/strict";
import test from "node:test";
import { detectImageMime, detectSupportFileMime } from "../lib/image-mime";
import { resolveDesignTokens } from "../lib/design-engine/theme-resolver";
import { createOAuthState, parseOAuthState, safeOAuthNextPath } from "../lib/google-auth";
import { normalizeMarketingIntegrations } from "../lib/marketing-integrations";
import { isSameOriginRequest } from "../lib/request-security";
import { DEFAULT_SITE_DESIGN } from "../lib/site-design";

test("image signature detection does not trust a filename", () => {
  assert.equal(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectImageMime(Buffer.from("not an image")), null);
});

test("support file signatures are checked for every allowed document type", () => {
  assert.equal(detectSupportFileMime(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(detectSupportFileMime(Buffer.from([0x50, 0x4b, 0x03, 0x04])), "application/zip");
  assert.equal(detectSupportFileMime(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), "image/heic");
  assert.equal(detectSupportFileMime(Buffer.from("<script>alert(1)</script>")), null);
});

test("same-origin guard rejects cross-site mutations", () => {
  assert.equal(isSameOriginRequest(new Request("https://shop.example/api/test", { headers: { origin: "https://shop.example" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://shop.example/api/test", { headers: { origin: "https://evil.example" } })), false);
});

test("post-auth redirects stay on the storefront origin", () => {
  assert.equal(safeOAuthNextPath("/account?tab=orders"), "/account?tab=orders");
  assert.equal(safeOAuthNextPath("//evil.example"), "/account");
  assert.equal(safeOAuthNextPath("/\\evil.example"), "/account");
  assert.equal(parseOAuthState(createOAuthState("/\\evil.example"))?.next, "/account");
});

test("stored marketing IDs cannot break out of generated pixel scripts", () => {
  const valid = normalizeMarketingIntegrations({ google: { enabled: true, id: "GTM-ABC_123" } });
  const malicious = normalizeMarketingIntegrations({ meta: { enabled: true, id: "1');alert(1);//" } });
  assert.equal(valid.google.id, "GTM-ABC_123");
  assert.equal(malicious.meta.id, "");
});

test("design token overrides cannot break out of the generated style element", () => {
  const tokens = resolveDesignTokens({
    ...DEFAULT_SITE_DESIGN,
    designTokensJson: JSON.stringify({ "color.primary": "red}</style><script>alert(1)</script>" }),
  });
  assert.doesNotMatch(String(tokens["color.primary"]), /[{};<>]/);
});
