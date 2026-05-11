"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RecipientsPage() {
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
    <DashboardShell title="Vos destinataires" subtitle="Gérer vos proches pour des envois rapides.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Destinataires"</h2>
        <p>Ce contenu sera remplacé par la liste de vos destinataires.</p>
      </div>
    </DashboardShell>
  );
}
