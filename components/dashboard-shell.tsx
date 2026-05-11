"use client";

import React from "react";
import Link from "next/link";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { BellIcon, DownloadIcon, SendIcon } from "./icons";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DashboardShell({ children, title, subtitle, actions }: DashboardShellProps) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="toolbar">
            {actions ? actions : (
              <>
                <button className="btn btn-icon" title="Notifications">
                  <BellIcon style={{ width: "18px", height: "18px" }} />
                </button>
                <button className="btn btn-ghost">
                  <DownloadIcon style={{ width: "16px", height: "16px" }} />
                  Exporter
                </button>
                <Link href="/transfer" className="btn btn-primary">
                  <SendIcon style={{ width: "16px", height: "16px" }} />
                  Nouvel envoi
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
