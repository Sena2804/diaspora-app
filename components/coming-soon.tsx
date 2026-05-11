"use client";

import React from "react";

interface ComingSoonProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  bullets?: string[];
  cta?: { href: string; label: string };
}

export function ComingSoon({ icon, title, description, bullets, cta }: ComingSoonProps) {
  return (
    <div
      style={{
        padding: 40,
        borderRadius: 20,
        background: "var(--bg-elevated)",
        border: "1px dashed var(--border)",
        maxWidth: 720,
        textAlign: "center",
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--primary-soft)",
            color: "var(--primary)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 18px",
          }}
        >
          {icon}
        </div>
      )}
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 auto 22px", maxWidth: 480 }}>
        {description}
      </p>

      {bullets && bullets.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 auto 22px",
            display: "grid",
            gap: 8,
            maxWidth: 360,
            textAlign: "left",
          }}
        >
          {bullets.map((b) => (
            <li
              key={b}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  marginTop: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  flexShrink: 0,
                }}
              />
              {b}
            </li>
          ))}
        </ul>
      )}

      <span
        style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          background: "var(--gold-soft, rgba(251,191,36,0.16))",
          color: "var(--gold, #b45309)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginRight: 10,
        }}
      >
        Roadmap v1.1
      </span>

      {cta && (
        <a className="btn btn-primary" href={cta.href} style={{ marginLeft: 10 }}>
          {cta.label}
        </a>
      )}
    </div>
  );
}
