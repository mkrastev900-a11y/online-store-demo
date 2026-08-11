/**
 * Runs before React hydration in Next.js 16.
 * Keeps the saved light/dark theme without rendering a <script> tag
 * from a React component.
 */
try {
  const saved = window.localStorage.getItem("zlatevi-theme");
  const theme =
    saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
}
