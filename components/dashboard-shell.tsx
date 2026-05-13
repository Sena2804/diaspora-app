"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { SendIcon } from "./icons";
import { useAuth } from "@/context/AuthContext";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** Custom right-aligned topbar actions. Defaults are role-aware:
   *  - sender: shows "Nouvel envoi" + theme toggle
   *  - receiver: shows theme toggle only (no send action — they receive money) */
  actions?: React.ReactNode;
}

export function DashboardShell({ children, title, subtitle, actions }: DashboardShellProps) {
  const { user } = useAuth();
  const isReceiver = user?.role === "receiver";

  return (
    <div className="shell">
      <Sidebar />
      <main className="main dc-page-in">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="toolbar">
            {actions !== undefined
              ? actions
              : !isReceiver && (
                  <Link href="/transfer" className="btn btn-primary">
                    <SendIcon style={{ width: "16px", height: "16px" }} />
                    Nouvel envoi
                  </Link>
                )}
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
