import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const AccountSettings = () => {
  const { token, updateUser } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAccount = async () => {
      if (!token) return;
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/account`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load account");
        }

        const account = await response.json();
        setName(account.name || "");
        setEmail(account.email || "");
      } catch (fetchError) {
        console.error("[AccountSettings] Fetch error", fetchError.message);
        setError(fetchError.message || "Could not load account details");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAccount();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: String(name || "").trim(),
      email: String(email || "")
        .trim()
        .toLowerCase(),
      ...(currentPassword && newPassword
        ? {
            currentPassword,
            newPassword,
          }
        : {}),
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/account`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Failed to save account details");
      }

      updateUser((previous) => ({
        ...(previous || {}),
        email: body.account?.email || payload.email,
      }));

      setCurrentPassword("");
      setNewPassword("");
      setMessage(
        body.passwordChanged
          ? "Account and password updated."
          : "Account details updated.",
      );
    } catch (saveError) {
      console.error("[AccountSettings] Save error", saveError.message);
      setError(saveError.message || "Could not save account details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="section-heading">
        <h2>Account Settings</h2>
        <p>Update your login identity and strengthen account security.</p>
      </div>

      {isLoading ? <p className="muted-text">Loading account...</p> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
      {message ? <div className="status-banner success">{message}</div> : null}

      <div className="panel-card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Full Name</label>
            <input
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
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
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Current Password</label>
            <input
              className="field-input"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Required only when changing password"
            />
          </div>
          <div>
            <label className="field-label">New Password</label>
            <input
              className="field-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Min 10 chars, upper/lower/number/symbol"
            />
          </div>
        </div>

        <div className="panel-actions">
          <button
            type="button"
            className="primary-button"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save Account"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default AccountSettings;
