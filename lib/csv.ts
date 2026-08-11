export function safeCsvCell(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
