import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const SuperAdminLogin = () => {
  const { login, isLoading } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login(email, password, "SUPER_ADMIN");
    } catch (loginError) {
      setError(loginError.message || "SuperAdmin login failed.");
    }
  };

  return (
    <div className="auth-wrap auth-wrap-admin">
      <div className="auth-card auth-card-admin">
        <div className="auth-brand">Whats_CSR</div>
        <h1 className="auth-title">SuperAdmin Login</h1>
        <p className="auth-subtitle">
          Authorized platform administrators only.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="field-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="primary-button w-full"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
