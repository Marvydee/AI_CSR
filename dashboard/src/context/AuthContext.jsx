import React, { createContext, useState, useCallback } from "react";

export const AuthContext = createContext({});

const readStoredUser = () => {
  const raw = localStorage.getItem("authUser");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(localStorage.getItem("accessToken"));
  const [isLoading, setIsLoading] = useState(false);
  const authTimeoutMs = Number(import.meta.env.VITE_AUTH_TIMEOUT_MS || 15000);

  const submitAuthRequest = useCallback(
    async ({ endpoint, payload }) => {
      const controller = new AbortController();
      const timeoutMs = Number.isFinite(authTimeoutMs) ? authTimeoutMs : 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}${endpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          let serverMessage = "Request failed";
          try {
            const body = await response.json();
            if (typeof body?.error === "string" && body.error.trim()) {
              serverMessage = body.error;
            }
          } catch {
            // keep fallback message
          }

          throw new Error(serverMessage);
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [authTimeoutMs],
  );

  const login = useCallback(
    async (email, password, role = "BUSINESS_ADMIN") => {
      setIsLoading(true);

      try {
        const targetRole =
          role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "BUSINESS_ADMIN";
        const endpoint =
          targetRole === "SUPER_ADMIN"
            ? "/api/auth/superadmin/login"
            : "/api/auth/admin/login";
        const data = await submitAuthRequest({
          endpoint,
          payload: { email, password },
        });
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("authUser", JSON.stringify(data.user));

        return data;
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Login timed out. Check backend/DB connection and try again.",
          );
        }

        console.error("[Auth] Login error", error.message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [submitAuthRequest],
  );

  const signup = useCallback(
    async ({ fullName, email, password, businessName }) => {
      setIsLoading(true);
      try {
        const data = await submitAuthRequest({
          endpoint: "/api/auth/admin/signup",
          payload: { fullName, email, password, businessName },
        });

        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("authUser", JSON.stringify(data.user));

        return data;
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Signup timed out. Check backend/DB connection and try again.",
          );
        }

        console.error("[Auth] Signup error", error.message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [submitAuthRequest],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authUser");
  }, []);

  const updateUser = useCallback((nextUserOrUpdater) => {
    setUser((previousUser) => {
      const resolvedUser =
        typeof nextUserOrUpdater === "function"
          ? nextUserOrUpdater(previousUser)
          : nextUserOrUpdater;
      localStorage.setItem("authUser", JSON.stringify(resolvedUser));
      return resolvedUser;
    });
  }, []);

  const value = {
    user,
    token,
    isLoading,
    login,
    signup,
    logout,
    updateUser,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
