"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface MeResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    role: string;
  };
  projects: {
    projectId: string;
    projectName: string;
    projectRole: string;
  }[];
}

interface AuthContextValue {
  token: string | null;
  user: MeResponse["user"] | null;
  projects: MeResponse["projects"];
  loading: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [projects, setProjects] = useState<MeResponse["projects"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("capi_token") : null;
    if (stored) {
      setTokenState(stored);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function fetchMe() {
      if (!token) {
        setUser(null);
        setProjects([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await apiFetch<MeResponse>("/auth/me", {
        method: "GET",
        token,
      });
      if (error || !data?.success) {
        setUser(null);
        setProjects([]);
        setTokenState(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("capi_token");
        }
      } else {
        setUser(data.user);
        setProjects(data.projects);
      }
      setLoading(false);
    }
    fetchMe();
  }, [token]);

  const setToken = (value: string | null) => {
    setTokenState(value);
    if (typeof window !== "undefined") {
      if (value) {
        localStorage.setItem("capi_token", value);
      } else {
        localStorage.removeItem("capi_token");
      }
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProjects([]);
  };

  return (
    <AuthContext.Provider
      value={{ token, user, projects, loading, setToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
