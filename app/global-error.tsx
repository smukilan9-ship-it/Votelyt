"use client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
            We hit an unexpected problem. Please try again, or contact the election admin if it
            keeps happening.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: 44,
              padding: "0.7rem 1.5rem",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(135deg, #5AA7FF, #1A5FBF)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
