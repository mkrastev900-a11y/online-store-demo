import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_GLOSSARY,
  ADMIN_HELP_SECTIONS,
  ADMIN_TRAINING_MAP,
  getAdminHelpSectionForPath,
  getVisibleAdminHelpSections,
  searchAdminGlossary,
  searchAdminHelp,
} from "../lib/admin-help-content";

test("admin training map covers every audited route and resolves its topic", () => {
  assert.equal(ADMIN_TRAINING_MAP.length, 30);
  assert.equal(new Set(ADMIN_TRAINING_MAP.map((route) => route.route)).size, 30);

  for (const route of ADMIN_TRAINING_MAP) {
    const pathname = route.route.replace(":id", "22");
    assert.equal(
      getAdminHelpSectionForPath(pathname)?.id,
      route.topicId,
      `${route.route} must resolve to ${route.topicId}`,
    );
  }

  assert.equal(getAdminHelpSectionForPath("/admin/orders/123")?.id, "orders");
  assert.equal(getAdminHelpSectionForPath("/admin/products/22/edit")?.id, "product-edit");
  assert.equal(getAdminHelpSectionForPath("/admin/products/new")?.id, "product-create");
  assert.equal(getAdminHelpSectionForPath("/admin/support")?.id, "support-rma");
  assert.equal(getAdminHelpSectionForPath("/visual-editor")?.id, "visual-editor");
});

test("every help topic uses the complete beginner training structure", () => {
  assert.ok(ADMIN_HELP_SECTIONS.length >= 28);
  assert.ok(ADMIN_HELP_SECTIONS.reduce((sum, section) => sum + section.controls.length, 0) >= 300);
  assert.ok(ADMIN_HELP_SECTIONS.reduce((sum, section) => sum + section.workflows.length, 0) >= 40);

  for (const section of ADMIN_HELP_SECTIONS) {
    assert.ok(section.id.length > 1);
    assert.ok(section.beginner.length > 40, `${section.id} needs a beginner introduction`);
    assert.ok(section.whenToUse.length > 0, `${section.id} needs when-to-use guidance`);
    assert.ok(section.whenNotToUse.length > 0, `${section.id} needs when-not-to-use guidance`);
    assert.ok(section.screen.length > 0, `${section.id} needs a screen description`);
    assert.ok(section.controls.length > 0, `${section.id} needs documented controls`);
    assert.ok(section.checklist.length > 0, `${section.id} needs a checklist`);

    for (const control of section.controls) {
      assert.ok(control.purpose.length > 10, `${section.id}/${control.id} needs a purpose`);
      assert.ok(control.how.length > 0, `${section.id}/${control.id} needs usage steps`);
      assert.ok(control.after.length > 10, `${section.id}/${control.id} needs an after-action explanation`);
      assert.ok(control.customerImpact.length > 5, `${section.id}/${control.id} needs customer impact`);
      assert.ok(control.success.length > 5, `${section.id}/${control.id} needs a success signal`);
    }
  }
});

test("SUPER_ADMIN visibility and sub-admin permission filtering are enforced", () => {
  const superSections = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: true,
    isDesignOwner: true,
  });
  assert.equal(superSections.length, ADMIN_HELP_SECTIONS.length);
  assert.ok(superSections.find((section) => section.id === "administrators")?.controls.some((item) => item.name.includes("Повиши в главен")));

  const orderViewerSections = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: false,
    isDesignOwner: false,
    permissions: ["ORDERS:VIEW"],
  });
  const orders = orderViewerSections.find((section) => section.id === "orders");
  assert.ok(orders);
  assert.ok(!orders.controls.some((item) => item.name.includes("Потвърди")));
  assert.ok(!orders.controls.some((item) => item.name.includes("Създай товарителница")));
  assert.ok(!orderViewerSections.some((section) => section.id === "visual-editor"));
  assert.ok(!orderViewerSections.some((section) => section.id === "administrators"));

  const orderOperatorSections = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: false,
    permissions: ["ORDERS:VIEW", "ORDERS:CONFIRM", "ORDERS:SHIP"],
  });
  const operatorOrders = orderOperatorSections.find((section) => section.id === "orders");
  assert.ok(operatorOrders?.controls.some((item) => item.name.includes("Потвърди")));
  assert.ok(operatorOrders?.controls.some((item) => item.name.includes("Създай товарителница")));
  assert.ok(!operatorOrders?.controls.some((item) => item.name.includes("Маркирай доставена")));
});

test("design topics follow SUPER_ADMIN role and WEB_DESIGN permissions", () => {
  const regularSuper = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: true,
    isDesignOwner: false,
  });
  assert.ok(regularSuper.some((section) => section.id === "visual-editor"));
  assert.ok(regularSuper.some((section) => section.id === "cms-models"));

  const regularAdmin = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: false,
    isDesignOwner: false,
    permissions: [],
  });
  assert.ok(!regularAdmin.some((section) => section.id === "visual-editor"));
  assert.ok(!regularAdmin.some((section) => section.id === "cms-models"));

  const designOwner = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: false,
    isDesignOwner: false,
    permissions: ["WEB_DESIGN:VIEW", "WEB_DESIGN:EDIT"],
  });
  assert.ok(designOwner.some((section) => section.id === "visual-editor"));
  assert.ok(designOwner.some((section) => section.id === "cms-models"));
});

test("help and glossary search cover workflows, controls and Bulgarian questions", () => {
  const allVisible = getVisibleAdminHelpSections(ADMIN_HELP_SECTIONS, {
    isSuperAdmin: true,
    isDesignOwner: true,
  });

  assert.equal(searchAdminHelp("как да върна пари", allVisible)[0]?.topicId, "support-rma");
  assert.ok(searchAdminHelp("запази", allVisible).length > 5);
  assert.ok(searchAdminHelp("размер", allVisible).some((result) => result.topicId === "sizes"));
  assert.ok(searchAdminHelp("товарителница", allVisible).some((result) => result.topicId === "orders"));

  assert.ok(ADMIN_GLOSSARY.length >= 75);
  assert.equal(searchAdminGlossary("складов код", ADMIN_GLOSSARY)[0]?.term, "SKU");
  assert.ok(searchAdminGlossary("възстановяване на сума", ADMIN_GLOSSARY).some((entry) => entry.term === "Refund"));
  assert.ok(searchAdminGlossary("двуфакторно", ADMIN_GLOSSARY).some((entry) => entry.term === "2FA"));
});

test("floating helper has open, close and an always-accessible X button", () => {
  const source = readFileSync("components/admin/AdminHelpAssistant.tsx", "utf8");

  assert.match(source, /setOpen\(true\)/);
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /className=\{styles\.floatingClose\}/);
  assert.match(source, /aria-label="Затвори помощника"/);
});

test("floating helper uses one natural full-height scroll container without a scroll loop", () => {
  const source = readFileSync("components/admin/AdminHelpAssistant.tsx", "utf8");
  const css = readFileSync("components/admin/AdminHelpAssistant.module.css", "utf8");
  const controlsBlock = css.match(/\.controlsBlock\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const scrollerBlock = css.match(/\.panelScroller\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const drawerBlock = css.match(/\.drawer\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const closeBlock = css.match(/\.floatingClose\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.doesNotMatch(source, /onScroll=|scrollTop|wheel|ResizeObserver|headerHidden|handleContentScroll|setHeaderVisibility/);
  assert.doesNotMatch(controlsBlock, /position:\s*(?:fixed|sticky)/);
  assert.match(scrollerBlock, /height:\s*100%/);
  assert.match(scrollerBlock, /overflow-y:\s*auto/);
  assert.match(drawerBlock, /height:\s*100dvh/);
  assert.match(closeBlock, /position:\s*absolute/);
  assert.doesNotMatch(css, /headerSlot|headerControlsHidden|miniToggle/);
});
