"use client";

import React from "react";

interface SpinnerProps {
  size?: number;
  color?: string;
  inline?: boolean;
}

/** A minimal inline spinner. 14px by default, matches button icon size. */
export function Spinner({ size = 14, color = "currentColor", inline = true }: SpinnerProps) {
  return (
    <svg
      className="dc-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={inline ? { display: "inline-block", verticalAlign: "middle" } : undefined}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.18" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
