"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="bg">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f2ef", color: "#2b1720" }}>
          <section style={{ maxWidth: 620, padding: 28, border: "1px solid rgba(105, 9, 47, .12)", borderRadius: 14, background: "#fffdfb" }}>
            <p style={{ margin: "0 0 8px", color: "#9b6e7f", fontSize: 11, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>Системна грешка</p>
            <h1 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 34 }}>Админ панелът не се зареди</h1>
            <p style={{ lineHeight: 1.6 }}>{error.message || "Възникна неочаквана грешка при зареждане."}</p>
            {error.digest && <p style={{ color: "#8b6a77" }}>Код: {error.digest}</p>}
            <button type="button" onClick={reset} style={{ minHeight: 42, padding: "0 16px", border: "1px solid #5d0829", borderRadius: 10, background: "var(--brand-primary)", color: "#f8e4a6", fontWeight: 900, cursor: "pointer" }}>
              Опитай отново
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
