"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }
  return (
    <DashboardShell title="Paramètres" subtitle="Gérer les préférences de votre compte.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Paramètres"</h2>
        <p>Ce contenu sera remplacé par les réglages du compte.</p>
      </div>
    </DashboardShell>
  );
}
