'use client';

import { createContext, useContext, ReactNode } from 'react';

interface AuthUser {
  sub: string;
  role: string;
  tenantId: string | null;
  plan: string;
}

interface AuthContextValue {
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthUser;
}) {
  return (
    <AuthContext.Provider value={{ user: initialUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext deve ser usado dentro de AuthProvider');
  return ctx;
}
