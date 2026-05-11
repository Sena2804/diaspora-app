"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SchedulePage() {
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
    <DashboardShell title="Programmer un envoi" subtitle="Gérer vos transferts récurrents.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Programmer"</h2>
        <p>Ce contenu sera remplacé par la gestion des envois programmés.</p>
      </div>
    </DashboardShell>
  );
}
