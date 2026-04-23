import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const Signup = () => {
  const { signup, isLoading } = useContext(AuthContext);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await signup({ fullName, email, password, businessName });
      window.history.replaceState({}, "", "/onboarding");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (signupError) {
      setError(signupError.message || "Could not create account");
    }
  };

  return (
    <div className="auth-wrap auth-wrap-admin">
      <div className="auth-card auth-card-admin">
        <div className="auth-brand">Whats_CSR</div>
        <h1 className="auth-title">Create your workspace</h1>
        <p className="auth-subtitle">
          Start free and set up your WhatsApp sales assistant in a guided flow.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Full Name</label>
            <input
              className="field-input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="field-label">Business Name</label>
            <input
              className="field-input"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              autoComplete="organization"
              placeholder="Business or brand name"
              required
            />
          </div>

          <div>
            <label className="field-label">Email Address</label>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="field-label">Password</label>
            <div className="relative">
              <input
                className="field-input pr-20"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Min 10 chars, upper/lower/number/symbol"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-700 hover:text-blue-800"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="field-label">Confirm Password</label>
            <input
              className="field-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter your password"
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
            {isLoading ? "Creating workspace..." : "Create Workspace"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            className="font-semibold text-blue-700 hover:text-blue-800"
            onClick={() => {
              window.history.replaceState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
