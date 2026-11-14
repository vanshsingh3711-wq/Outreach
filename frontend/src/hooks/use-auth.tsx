"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getStoredToken, setStoredToken, clearStoredToken, fetchApi, ApiError } from "@/lib/api-client";

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
  isAuthenticated: false,
  isLoading: true,
  isLocked: false,
  lockReason: null,
  unlockWithToken: async () => false,
  logout: () => {},
  checkAuth: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setIsAuthenticated(false);
      setIsLocked(true);
      setLockReason("Dashboard authentication token is required.");
      setIsLoading(false);
      return false;
    }

    setTokenState(currentToken);
    try {
      const res = await fetchApi<{ status: string; authenticated: boolean }>("/api/auth/check");
      if (res.authenticated) {
        setIsAuthenticated(true);
        setIsLocked(false);
        setLockReason(null);
        setIsLoading(false);
        return true;
      }
      throw new Error("Authentication failed");
    } catch (err: any) {
      setIsAuthenticated(false);
      setIsLocked(true);
      if (err instanceof ApiError && err.status === 401) {
        setLockReason("Dashboard token invalid or expired.");
      } else {
        setLockReason(err.message || "Failed to authenticate with backend.");
      }
      setIsLoading(false);
      return false;
    }
  }, []);

  const unlockWithToken = useCallback(
    async (newToken: string): Promise<boolean> => {
      const trimmed = newToken.trim();
      const saved = setStoredToken(trimmed);
      if (!saved) {
        setLockReason("Invalid token format (expected 43-128 chars).");
        return false;
      }
      setTokenState(trimmed);
      return await checkAuth();
    },
    [checkAuth]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setTokenState("");
    setIsAuthenticated(false);
    setIsLocked(true);
    setLockReason("You have logged out.");
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
