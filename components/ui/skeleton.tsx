"use client";

import React from "react";

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

/** A shimmering placeholder block. Default 16px tall, full-width. */
export function Skeleton({ height = 16, width = "100%", radius = 8, style }: SkeletonProps) {
  return (
    <span
      className="dc-skeleton"
      aria-hidden="true"
      style={{
        display: "block",
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        borderRadius: typeof radius === "number" ? `${radius}px` : radius,
        ...style,
      }}
    />
  );
}

/** Repeats a row-shaped skeleton — useful for list placeholders. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr auto",
            gap: 14,
            alignItems: "center",
            padding: 16,
            borderRadius: 12,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Skeleton height={44} width={44} radius="50%" />
          <div style={{ display: "grid", gap: 6 }}>
            <Skeleton height={14} width="40%" />
            <Skeleton height={12} width="60%" />
          </div>
          <Skeleton height={28} width={84} radius={999} />
        </div>
      ))}
    </div>
  );
}
