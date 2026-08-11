"use client";

import { useEffect } from "react";

type Theme = "light" | "dark";

function resolveTheme(): Theme {
  try {
    const saved = localStorage.getItem("zlatevi-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function ThemeInitializer() {
  useEffect(() => {
    const theme = resolveTheme();
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, []);

  return null;
}
