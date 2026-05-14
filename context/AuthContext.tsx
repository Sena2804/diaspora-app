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

type FrontendRole = 'sender' | 'receiver';
type DbRole = 'expediteur' | 'beneficiaire' | 'admin';

export type KycStatus = 'pending' | 'verified' | 'rejected';

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
  login: (email: string, password: string, role: FrontendRole) => Promise<AuthResult>;
  signup: (
    email: string,
    password: string,
    role: FrontendRole,
    phone?: string,
  ) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function dbToFrontendRole(db: DbRole): FrontendRole {
  return db === 'beneficiaire' ? 'receiver' : 'sender';
}
function frontendToDbRole(fe: FrontendRole): DbRole {
  return fe === 'receiver' ? 'beneficiaire' : 'expediteur';
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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone, wallet_id, first_name, last_name, country, kyc_status, phone_verified_at')
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

  const signup = async (
    email: string,
    password: string,
    role: FrontendRole,
    phone?: string,
  ): Promise<AuthResult> => {
    const dbRole = frontendToDbRole(role);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: dbRole, phone: phone ?? null } },
    });
    if (error || !data.user) {
      const code = classifySupabaseError(error?.message);
      return { ok: false, code, message: humanMessage(code) };
    }
    // The SQL trigger creates the profile with default role 'expediteur'.
    // Write back the actual role + phone the user picked.
    const updates: { role?: DbRole; phone?: string } = {};
    if (dbRole !== 'expediteur') updates.role = dbRole;
    if (phone) updates.phone = phone;
    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', data.user.id);
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
