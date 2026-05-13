"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
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

  const isReceiver = user?.role === "receiver";

  const navItems = isReceiver
    ? [
        { label: "Mon portefeuille", icon: DashboardIcon, href: "/wallet", badge: null },
        { label: "Historique reçus", icon: HistoryIcon, href: "/history", badge: null },
      ]
    : [
        { label: "Tableau de bord", icon: DashboardIcon, href: "/dashboard", badge: null },
        { label: "Nouvel envoi", icon: SendIcon, href: "/transfer", badge: null },
        { label: "Historique", icon: HistoryIcon, href: "/history", badge: null },
        { label: "Destinataires", icon: UsersIcon, href: "/recipients", badge: null },
      ];

  const toolItems = isReceiver
    ? [
        { label: "Preuves blockchain", icon: ShieldIcon, href: "/blockchain" },
        { label: "Paramètres", icon: SettingsIcon, href: "/settings" },
      ]
    : [
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
        <span className="nav-label">{isReceiver ? "Bénéficiaire" : "Expéditeur"}</span>
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
          <div className="meta">{user?.role === 'sender' ? 'Diaspora · Expéditeur' : 'Bénéficiaire · Bénin'}</div>
        </div>
        <button
          onClick={logout}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            color: 'var(--text-tertiary)',
            display: 'inline-flex',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent, #EA580C)';
            e.currentTarget.style.borderColor = 'var(--accent, #EA580C)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <LogOut style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    </aside>
  );
}
