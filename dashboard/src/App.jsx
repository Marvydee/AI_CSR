import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import OnboardingWizard from "./pages/OnboardingWizard";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

export default function App() {
  const { isAuthenticated, user } = useContext(AuthContext);
  const [path, setPath] = useState(
    String(window.location.pathname || "/").toLowerCase(),
  );

  useEffect(() => {
    const handlePopState = () => {
      setPath(String(window.location.pathname || "/").toLowerCase());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const isSuperAdminPath = path.startsWith("/superadmin");
  const isSignupPath = path.startsWith("/signup");

  if (!isAuthenticated) {
    if (isSignupPath) {
      return <Signup />;
    }

    return isSuperAdminPath ? <SuperAdminLogin /> : <Login />;
  }

  return user?.role === "SUPER_ADMIN" ? (
    <SuperAdminDashboard />
  ) : user?.onboardingCompleted ? (
    <AdminDashboard />
  ) : (
    <OnboardingWizard />
  );
}
