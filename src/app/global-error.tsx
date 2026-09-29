"use client";

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it must render its own <html> and <body>.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fafafa", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#525252", margin: "0 0 16px" }}>
              The app hit an unexpected problem. Please try again.
            </p>
            {error.digest && <p style={{ fontSize: 12, color: "#a3a3a3" }}>Reference: {error.digest}</p>}
            <button
              onClick={() => retry()}
              style={{ background: "#15803d", color: "#fff", border: 0, borderRadius: 6, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
