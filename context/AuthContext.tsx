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

interface AppUser {
  id: string;
  email: string;
  role: FrontendRole;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  /** True while the initial session check is in flight. Pages should hold
   *  off any redirect-decision until `loading === false`. */
  loading: boolean;
  login: (email: string, password: string, role: FrontendRole) => Promise<boolean>;
  signup: (email: string, password: string, role: FrontendRole) => Promise<boolean>;
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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single();
      if (profile?.role) role = dbToFrontendRole(profile.role as DbRole);
    } catch {
      // Trigger may not have inserted yet on first signup — fall back to default
    }
    setUser({
      id: authUser.id,
      email: authUser.email ?? '',
      role,
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

  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Login failed:', error.message);
      return false;
    }
    return true;
  };

  const signup = async (
    email: string,
    password: string,
    role: FrontendRole,
  ): Promise<boolean> => {
    const dbRole = frontendToDbRole(role);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: dbRole } },
    });
    if (error || !data.user) {
      console.error('Signup failed:', error?.message);
      return false;
    }
    // The SQL trigger handle_new_user creates the profile with the default
    // role 'expediteur'. If the user picked the bénéficiaire role, update it.
    if (dbRole !== 'expediteur') {
      await supabase.from('profiles').update({ role: dbRole }).eq('id', data.user.id);
    }
    return true;
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
