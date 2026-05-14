"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User as SupaUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Le concept "sender / receiver" a été abandonné session 8 — un seul profil
// unifié qui peut envoyer ET recevoir. Le champ `role` n'est conservé que pour
// compatibilité DB et n'a plus d'impact UX.
type FrontendRole = 'sender' | 'receiver';
type DbRole = 'expediteur' | 'beneficiaire' | 'admin';

export type KycStatus = 'pending' | 'verified' | 'rejected';

export interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;       // YYYY-MM-DD
  placeOfBirth: string;
  phone: string;             // Full E.164 form, ex. "+22901234567"
  country: string;           // ISO code, ex. "BJ", "FR"
  documentType: 'NPI' | 'CIN' | 'PASSPORT' | 'RESIDENCE_PERMIT' | 'DRIVER_LICENSE';
  documentNumber: string;
}

interface AppUser {
  id: string;
  email: string;
  role: FrontendRole;
  phone: string | null;
  walletId: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  kycStatus: KycStatus | null;
  phoneVerified: boolean;
  documentType: string | null;
  documentNumber: string | null;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; code: AuthErrorCode; message: string };

export type AuthErrorCode =
  | "invalid_credentials"
  | "user_already_exists"
  | "weak_password"
  | "email_not_confirmed"
  | "rate_limited"
  | "network"
  | "unknown";

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  /** True while the initial session check is in flight. Pages should hold
   *  off any redirect-decision until `loading === false`. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (payload: SignupPayload) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function dbToFrontendRole(db: DbRole): FrontendRole {
  return db === 'beneficiaire' ? 'receiver' : 'sender';
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Read the profile row that the SQL trigger created at signup. We do this
  // to know the user's role (expediteur / beneficiaire) so the sidebar and
  // protected pages can render the right variant.
  const hydrateFromSupabaseUser = async (authUser: SupaUser) => {
    let role: FrontendRole = 'sender';
    let phone: string | null = null;
    let walletId: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let country: string | null = null;
    let kycStatus: KycStatus | null = null;
    let phoneVerified = false;
    let documentType: string | null = null;
    let documentNumber: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone, wallet_id, first_name, last_name, country, kyc_status, phone_verified_at, document_type, document_number')
        .eq('id', authUser.id)
        .single();
      if (profile?.role) role = dbToFrontendRole(profile.role as DbRole);
      phone = profile?.phone ?? null;
      walletId = profile?.wallet_id ?? null;
      firstName = profile?.first_name ?? null;
      lastName = profile?.last_name ?? null;
      country = profile?.country ?? null;
      kycStatus = (profile?.kyc_status as KycStatus | undefined) ?? null;
      phoneVerified = !!profile?.phone_verified_at;
      documentType = profile?.document_type ?? null;
      documentNumber = profile?.document_number ?? null;
    } catch {
      // Trigger may not have inserted yet on first signup — fall back to defaults
    }
    setUser({
      id: authUser.id,
      email: authUser.email ?? '',
      role,
      phone,
      walletId,
      firstName,
      lastName,
      country,
      kycStatus,
      phoneVerified,
      documentType,
      documentNumber,
    });
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        hydrateFromSupabaseUser(session.user).finally(
          () => mounted && setLoading(false),
        );
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          hydrateFromSupabaseUser(session.user);
        } else {
          setUser(null);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classifySupabaseError = (msg: string | undefined): AuthErrorCode => {
    const m = (msg ?? '').toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid_credentials';
    if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) return 'user_already_exists';
    if (m.includes('password should be') || m.includes('weak password')) return 'weak_password';
    if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'email_not_confirmed';
    if (m.includes('rate limit') || m.includes('too many')) return 'rate_limited';
    if (m.includes('fetch') || m.includes('network')) return 'network';
    return 'unknown';
  };

  const humanMessage = (code: AuthErrorCode): string => {
    switch (code) {
      case 'invalid_credentials':
        return "Email ou mot de passe incorrect.";
      case 'user_already_exists':
        return "Un compte existe déjà avec cet email. Connectez-vous plutôt.";
      case 'weak_password':
        return "Mot de passe trop court (6 caractères minimum).";
      case 'email_not_confirmed':
        return "Email pas encore confirmé. Vérifiez votre boîte de réception.";
      case 'rate_limited':
        return "Trop de tentatives. Réessayez dans une minute.";
      case 'network':
        return "Impossible de joindre le serveur. Vérifiez votre connexion.";
      default:
        return "Une erreur inattendue est survenue.";
    }
  };

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const code = classifySupabaseError(error.message);
      return { ok: false, code, message: humanMessage(code) };
    }
    return { ok: true };
  };

  const signup = async (payload: SignupPayload): Promise<AuthResult> => {
    // Tout passe via options.data → la trigger SQL handle_new_user (sécurity
    // definer, donc bypass RLS) lit ces champs et crée le profil complet.
    // Cela marche même quand "Confirm email" est activé (pas de session
    // immédiate côté client).
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          first_name: payload.firstName,
          last_name: payload.lastName,
          date_of_birth: payload.dateOfBirth,
          place_of_birth: payload.placeOfBirth,
          phone: payload.phone,
          country: payload.country,
          document_type: payload.documentType,
          document_number: payload.documentNumber,
        },
      },
    });
    if (error || !data.user) {
      const code = classifySupabaseError(error?.message);
      return { ok: false, code, message: humanMessage(code) };
    }
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
