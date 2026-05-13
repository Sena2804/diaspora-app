"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer automatically when the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sidebar is open.
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  return (
    <div className="shell">
      <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div
        className={`sidebar-backdrop ${mobileNavOpen ? "show" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
      <main className="main dc-page-in">
        <div className="topbar">
          <div className="topbar-head">
            <button
              type="button"
              className="topbar-burger"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1>{title}</h1>
              {subtitle && <div className="sub">{subtitle}</div>}
            </div>
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
