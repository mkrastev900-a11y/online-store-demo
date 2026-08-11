/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- Existing behavior is intentional; warning-only patterns are retained to avoid release-risk refactors. */
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_DESIGN, preservePersistentSocialTokens, type SiteDesign } from "@/lib/site-design";

export type DesignThemeSummary = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: string;
  isActive: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

function normalizeSnapshot(value: unknown): SiteDesign {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SITE_DESIGN } as SiteDesign;
  return { ...DEFAULT_SITE_DESIGN, ...(value as Partial<SiteDesign>), id: 1 } as SiteDesign;
}

function snapshotSignature(value: unknown) {
  return JSON.stringify(normalizeSnapshot(value));
}

async function writeActiveDesign(tx: typeof prisma, snapshot: SiteDesign, actorId: number | null) {
  const current = await tx.siteDesignSettings.findUnique({
    where: { id: 1 },
    select: { facebookUrl: true, instagramUrl: true, tiktokUrl: true, designTokensJson: true },
  });
  const data: any = { ...snapshot };
  delete data.id;

  // Social-network configuration belongs to the dedicated Social Networks page.
  // Theme snapshots can be old, so never let Apply/Publish/Rollback erase it.
  if (current) {
    data.facebookUrl = current.facebookUrl;
    data.instagramUrl = current.instagramUrl;
    data.tiktokUrl = current.tiktokUrl;
    data.designTokensJson = preservePersistentSocialTokens(current.designTokensJson, data.designTokensJson);
  }

  await tx.siteDesignSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data, updatedById: actorId ?? undefined },
    update: { ...data, updatedById: actorId ?? undefined },
  });
}

export async function ensureDefaultTheme(actorId?: number | null) {
  const existing = await prisma.designTheme.findFirst({ orderBy: [{ isActive: "desc" }, { id: "asc" }] });
  if (existing) return existing;
  const snapshot = { ...DEFAULT_SITE_DESIGN };
  return prisma.designTheme.create({
    data: {
      name: "Основна тема",
      slug: "default",
      description: "Главна тема на магазина",
      status: "PUBLISHED",
      isActive: true,
      draftSnapshot: snapshot,
      publishedSnapshot: snapshot,
      publishedAt: new Date(),
      createdById: actorId ?? null,
      updatedById: actorId ?? null,
      versions: { create: { version: 1, label: "Начална версия", snapshot, createdById: actorId ?? null } },
    },
  });
}

export async function getDesignStudioState() {
  try {
    const theme = await ensureDefaultTheme();
    const [themes, versionState] = await Promise.all([
      prisma.designTheme.findMany({ orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }], select: { id: true, name: true, slug: true, description: true, status: true, isActive: true, publishedAt: true, updatedAt: true } }),
      getThemeVersionsState(theme.id),
    ]);
    return {
      activeThemeId: theme.id,
      activeVersionId: versionState.activeVersionId,
      design: normalizeSnapshot(theme.draftSnapshot),
      themes,
      versions: versionState.versions,
      hasUnpublishedChanges: JSON.stringify(theme.draftSnapshot) !== JSON.stringify(theme.publishedSnapshot),
    };
  } catch {
    return { activeThemeId: 0, activeVersionId: null, design: { ...DEFAULT_SITE_DESIGN } as SiteDesign, themes: [], versions: [], hasUnpublishedChanges: false };
  }
}

export async function saveThemeDraft(themeId: number, snapshot: SiteDesign, actorId: number, label = "Запазена версия") {
  return prisma.$transaction(async (tx) => {
    const last = await tx.designThemeVersion.findFirst({
      where: { themeId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const theme = await tx.designTheme.update({
      where: { id: themeId },
      data: { draftSnapshot: snapshot, status: "DRAFT", updatedById: actorId },
    });
    const savedVersion = await tx.designThemeVersion.create({
      data: {
        themeId,
        version: nextVersion,
        label: label.trim() || `Версия ${nextVersion}`,
        snapshot,
        createdById: actorId,
      },
    });
    return { theme, savedVersion };
  });
}

export async function applyThemeWithoutVersion(themeId: number, snapshot: SiteDesign, actorId: number) {
  const normalized = normalizeSnapshot(snapshot);
  return prisma.$transaction(async (tx) => {
    await tx.designTheme.updateMany({ data: { isActive: false } });
    const theme = await tx.designTheme.update({
      where: { id: themeId },
      data: {
        draftSnapshot: normalized,
        publishedSnapshot: normalized,
        status: "PUBLISHED",
        isActive: true,
        publishedAt: new Date(),
        updatedById: actorId,
      },
    });
    await writeActiveDesign(tx as unknown as typeof prisma, normalized, actorId);
    return { theme, snapshot: normalized };
  });
}

export async function publishTheme(themeId: number, snapshot: SiteDesign, actorId: number, label = "") {
  return prisma.$transaction(async (tx) => {
    const last = await tx.designThemeVersion.findFirst({ where: { themeId }, orderBy: { version: "desc" }, select: { version: true } });
    const nextVersion = (last?.version ?? 0) + 1;
    await tx.designTheme.updateMany({ data: { isActive: false } });
    const theme = await tx.designTheme.update({ where: { id: themeId }, data: { draftSnapshot: snapshot, publishedSnapshot: snapshot, status: "PUBLISHED", isActive: true, publishedAt: new Date(), updatedById: actorId } });
    await tx.designThemeVersion.create({ data: { themeId, version: nextVersion, label: label.trim() || `Публикувана версия ${nextVersion}`, snapshot, createdById: actorId } });
    await writeActiveDesign(tx as unknown as typeof prisma, snapshot, actorId);
    return { theme, version: nextVersion };
  });
}

export async function rollbackTheme(themeId: number, versionId: number, actorId: number) {
  const version = await prisma.designThemeVersion.findFirst({ where: { id: versionId, themeId }, select: { id: true, snapshot: true } });
  if (!version) throw new Error("Версията не е намерена.");
  const snapshot = normalizeSnapshot(version.snapshot);
  await applyThemeWithoutVersion(themeId, snapshot, actorId);
  return snapshot;
}

export async function getThemeVersionsState(themeId: number, take = 100) {
  const [theme, versions] = await Promise.all([
    prisma.designTheme.findUnique({ where: { id: themeId }, select: { draftSnapshot: true, publishedSnapshot: true } }),
    prisma.designThemeVersion.findMany({
      where: { themeId },
      orderBy: { version: "desc" },
      take,
      select: { id: true, version: true, label: true, createdAt: true, createdById: true, snapshot: true },
    }),
  ]);
  const authorIds = [...new Set(versions.map((item) => item.createdById).filter((id): id is number => typeof id === "number"))];
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const activeSignature = snapshotSignature(theme?.draftSnapshot ?? theme?.publishedSnapshot ?? DEFAULT_SITE_DESIGN);
  const activeVersionId = versions.find((item) => snapshotSignature(item.snapshot) === activeSignature)?.id ?? null;
  return {
    activeVersionId,
    versions: versions.map(({ snapshot: _snapshot, ...item }) => ({
      ...item,
      author: item.createdById ? authorMap.get(item.createdById) ?? null : null,
    })),
  };
}

export async function getThemeVersions(themeId: number, take = 100) {
  return (await getThemeVersionsState(themeId, take)).versions;
}

export async function deleteThemeVersion(themeId: number, versionId: number) {
  const version = await prisma.designThemeVersion.findFirst({
    where: { id: versionId, themeId },
    select: { id: true },
  });
  if (!version) throw new Error("Версията не е намерена.");
  await prisma.designThemeVersion.delete({ where: { id: versionId } });
  return { ok: true };
}
