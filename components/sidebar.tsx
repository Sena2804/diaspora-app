"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { 
  LogoIcon, 
  DashboardIcon, 
  SendIcon, 
  HistoryIcon, 
  UsersIcon, 
  CompareIcon, 
  ShieldIcon, 
  SettingsIcon 
} from "./icons";
import { useAuth } from "@/context/AuthContext";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { label: "Tableau de bord", icon: DashboardIcon, href: "/dashboard", badge: null },
    { label: "Nouvel envoi", icon: SendIcon, href: "/transfer", badge: null },
    { label: "Historique", icon: HistoryIcon, href: "/history", badge: "12" },
    { label: "Destinataires", icon: UsersIcon, href: "/recipients", badge: null },
  ];

  const toolItems = [
    { label: "Comparateur frais", icon: CompareIcon, href: "/compare" },
    { label: "Mes preuves blockchain", icon: ShieldIcon, href: "/blockchain" },
    { label: "Paramètres", icon: SettingsIcon, href: "/settings" },
  ];

  const getInitials = (email: string | undefined) => {
    if (!email) return "??";
    return email.split('@')[0].substring(0, 2).toUpperCase();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <LogoIcon style={{ width: "18px", height: "18px", color: "var(--bg-base)" }} />
        </div>
        <span className="name">Diaspora<span>Connect</span></span>
      </div>
      
      <nav className="nav-group">
        <span className="nav-label">Expéditeur</span>
        {navItems.map((item) => (
          <Link 
            key={item.href} 
            href={item.href} 
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <item.icon style={{ width: "16px", height: "16px" }} />
            {item.label}
            {item.badge && <span className="badge">{item.badge}</span>}
          </Link>
        ))}
      </nav>

      <nav className="nav-group">
        <span className="nav-label">Outils</span>
        {toolItems.map((item) => (
          <Link 
            key={item.href} 
            href={item.href} 
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <item.icon style={{ width: "16px", height: "16px" }} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="user-card">
        <div className="avatar">{getInitials(user?.email)}</div>
        <div className="info">
          <div className="name">{user?.email.split('@')[0]}</div>
          <div className="meta">Paris · {user?.role === 'sender' ? 'diaspora' : 'bénéficiaire'}</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronRight style={{ width: "14px", height: "14px", color: "var(--text-tertiary)" }} />
        </button>
      </div>
    </aside>
  );
}
