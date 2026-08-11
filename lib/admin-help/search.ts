import type {
  AdminGlossaryEntry,
  AdminHelpSearchResult,
  AdminHelpSection,
} from "./types";

export function normalizeAdminHelpSearch(value: string) {
  return value
    .toLocaleLowerCase("bg-BG")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

function searchTokens(query: string) {
  return normalizeAdminHelpSearch(query).split(/\s+/).filter(Boolean);
}

function bestContext(section: AdminHelpSection, tokens: string[]) {
  const candidates = [
    section.summary,
    section.purpose,
    section.beginner,
    ...section.screen,
    ...section.controls.flatMap((control) => [
      `${control.name}: ${control.purpose}`,
      control.example ?? "",
      control.after,
      ...control.errors,
      ...control.avoid,
    ]),
    ...section.workflows.flatMap((item) => [item.title, item.goal, ...item.steps]),
    ...section.errors.flatMap((item) => [item.message, item.meaning, item.action]),
  ].filter(Boolean);
  return candidates.find((candidate) => {
    const value = normalizeAdminHelpSearch(candidate);
    return tokens.every((token) => value.includes(token));
  }) ?? section.summary;
}

export function searchAdminHelp(
  query: string,
  sections: readonly AdminHelpSection[],
): AdminHelpSearchResult[] {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];

  return sections.map((section) => {
    const title = normalizeAdminHelpSearch(`${section.title} ${section.shortTitle}`);
    const controls = normalizeAdminHelpSearch(section.controls.map((item) => item.name).join(" "));
    const workflows = normalizeAdminHelpSearch(section.workflows.map((item) => `${item.title} ${item.goal}`).join(" "));
    const keywords = normalizeAdminHelpSearch(section.keywords.join(" "));
    const full = normalizeAdminHelpSearch([
      title,
      section.summary,
      section.purpose,
      section.beginner,
      ...section.whenToUse,
      ...section.whenNotToUse,
      ...section.screen,
      ...section.controls.flatMap((item) => [item.name, item.purpose, item.when, ...item.how, item.format ?? "", item.example ?? "", item.after, item.customerImpact, item.success, ...item.errors, ...item.avoid]),
      ...section.statuses.flatMap((item) => [item.name, item.meaning, item.next, item.warning ?? ""]),
      ...section.workflows.flatMap((item) => [item.title, item.goal, ...item.steps, item.result, item.warning ?? ""]),
      ...section.errors.flatMap((item) => [item.message, item.meaning, item.action]),
      ...section.mistakes,
      ...section.checklist,
      ...section.tips,
      keywords,
    ].join(" "));
    if (!tokens.every((token) => full.includes(token))) return null;
    let score = 1;
    for (const token of tokens) {
      if (title.includes(token)) score += 8;
      if (controls.includes(token)) score += 6;
      if (workflows.includes(token)) score += 5;
      if (keywords.includes(token)) score += 4;
    }
    return {
      topicId: section.id,
      title: section.title,
      context: bestContext(section, tokens),
      score,
    };
  }).filter((result): result is AdminHelpSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "bg"));
}

export function searchAdminGlossary(
  query: string,
  entries: readonly AdminGlossaryEntry[],
) {
  const tokens = searchTokens(query);
  if (!tokens.length) return [...entries];
  return entries.filter((entry) => {
    const full = normalizeAdminHelpSearch([
      entry.term,
      entry.fullName,
      entry.bulgarian,
      entry.meaning,
      entry.inStore,
      entry.example,
      ...(entry.aliases ?? []),
    ].join(" "));
    return tokens.every((token) => full.includes(token));
  });
}
