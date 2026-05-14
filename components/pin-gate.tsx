"use client";

/**
 * PinGate — affiche automatiquement le PinModal en mode setup si le user
 * connecté n'a pas encore défini de PIN. À monter dans le shell (une fois
 * pour toutes les pages protégées), ne bloque pas la navigation mais force
 * la modale tant que le PIN n'est pas créé.
 *
 * Expose aussi via React context un helper `confirmWithPin(...)` pour
 * déclencher la modale en mode verify avant une action sensible.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PinModal } from "./pin-modal";
import { useAuth } from "@/context/AuthContext";

interface ConfirmOptions {
  title?: string;
  subtitle?: string;
}

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const PinGateContext = createContext<{ confirmWithPin: ConfirmFn } | null>(null);

export function usePinConfirm() {
  const ctx = useContext(PinGateContext);
  if (!ctx) {
    // Si la modale n'est pas montée (page hors shell), on fail closed.
    return {
      confirmWithPin: async () => {
        console.warn("[usePinConfirm] PinGate not mounted — action allowed without confirmation.");
        return true;
      },
    };
  }
  return ctx;
}

export function PinGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  // Verify-mode modal state, controlled by `confirmWithPin`.
  const [verifyState, setVerifyState] = useState<{
    open: boolean;
    title?: string;
    subtitle?: string;
  }>({ open: false });
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  // Check PIN status when the session is ready.
  useEffect(() => {
    if (loading || !isAuthenticated) {
      setHasPin(null);
      setSetupOpen(false);
      return;
    }
    let aborted = false;
    fetch("/api/pin")
      .then((r) => r.json())
      .then((data) => {
        if (aborted) return;
        const value = !!data?.has_pin;
        setHasPin(value);
        if (!value) setSetupOpen(true);
      })
      .catch(() => {
        if (!aborted) setHasPin(null);
      });
    return () => {
      aborted = true;
    };
  }, [isAuthenticated, loading]);

  const confirmWithPin = useCallback<ConfirmFn>((options) => {
    // Si pas de PIN défini, on force le setup d'abord et on refuse l'action.
    if (hasPin === false) {
      setSetupOpen(true);
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setVerifyState({ open: true, title: options?.title, subtitle: options?.subtitle });
    });
  }, [hasPin]);

  return (
    <PinGateContext.Provider value={{ confirmWithPin }}>
      {children}

      <PinModal
        open={setupOpen}
        mode="setup"
        blocking
        onClose={() => setSetupOpen(false)}
        onSuccess={() => {
          setHasPin(true);
          setSetupOpen(false);
        }}
      />

      <PinModal
        open={verifyState.open}
        mode="verify"
        title={verifyState.title}
        subtitle={verifyState.subtitle}
        onClose={() => {
          setVerifyState({ open: false });
          resolveRef.current?.(false);
          resolveRef.current = null;
        }}
        onSuccess={() => {
          setVerifyState({ open: false });
          resolveRef.current?.(true);
          resolveRef.current = null;
        }}
      />
    </PinGateContext.Provider>
  );
}
