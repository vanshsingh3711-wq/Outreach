"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getStoredToken, setStoredToken, clearStoredToken, fetchApi } from "@/lib/api-client";

interface AuthContextType {
  token: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLocked: boolean;
  lockReason: string | null;
  unlockWithToken: (newToken: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  token: "",
  isAuthenticated: true,
  isLoading: false,
  isLocked: false,
  lockReason: null,
  unlockWithToken: async () => true,
  logout: () => {},
  checkAuth: async () => true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const currentToken = getStoredToken();
    if (currentToken) {
      setTokenState(currentToken);
    }
    try {
      await fetchApi<{ status: string; authenticated: boolean }>("/api/auth/check");
    } catch {
      // Best-effort check; local dashboard remains unlocked
    }
    setIsAuthenticated(true);
    setIsLocked(false);
    setLockReason(null);
    setIsLoading(false);
    return true;
  }, []);

  const unlockWithToken = useCallback(
    async (newToken: string): Promise<boolean> => {
      const trimmed = newToken.trim();
      setStoredToken(trimmed);
      setTokenState(trimmed);
      return await checkAuth();
    },
    [checkAuth]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setTokenState("");
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        isLoading,
        isLocked,
        lockReason,
        unlockWithToken,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
