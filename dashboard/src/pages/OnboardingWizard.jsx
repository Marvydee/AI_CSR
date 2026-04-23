import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";

const OnboardingWizard = () => {
  const { token, user, updateUser } = useContext(AuthContext);
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [whatsappBusinessNumber, setWhatsappBusinessNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [onboarding, setOnboarding] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedWhatsApp, setShowAdvancedWhatsApp] = useState(false);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onboardingSteps = useMemo(
    () => [
      {
        key: "businessProfile",
        title: "Business details",
        description: "Confirm the workspace name and owner email.",
        icon: "building",
      },
      {
        key: "whatsappConnection",
        title: "WhatsApp connection",
        description: "Connect once in Meta. We auto-link your workspace.",
        icon: "inbox",
      },
      {
        key: "bankDetails",
        title: "Bank details",
        description: "Add account details for payments and support flow.",
        icon: "user",
      },
      {
        key: "aiSetup",
        title: "AI settings",
        description:
          "Optional: refine the tone and context your AI should use.",
        icon: "cpu",
        optional: true,
      },
    ],
    [],
  );

  const isComplete = Boolean(onboarding?.completed);

  useEffect(() => {
    const fetchOnboarding = async () => {
      if (!token || !user?.businessId) return;

      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/profile`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load onboarding state");
        }

        const profile = await response.json();
        setBusinessName(profile.name || user.businessName || "");
        setBusinessEmail(profile.email || user.email || "");
        setWhatsappPhoneNumberId(profile.whatsappPhoneNumberId || "");
        setWhatsappBusinessNumber(profile.whatsappBusinessNumber || "");
        setBankName(profile.bankName || "");
        setBankAccountName(profile.bankAccountName || "");
        setBankAccountNumber(profile.bankAccountNumber || "");
        setCustomSystemPrompt(profile.customSystemPrompt || "");
        setOnboarding(profile.onboarding || null);
      } catch (fetchError) {
        console.error("[OnboardingWizard] Fetch error", fetchError.message);
        setError(fetchError.message || "Could not load onboarding flow");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOnboarding();
  }, [token, user?.businessId, user?.businessName, user?.email]);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setError(
          `Meta connection failed: ${params.get("error_description") || error}`,
        );
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      if (!code || !state) return;

      if (!token || !user?.businessId) return;

      try {
        setIsConnectingWhatsApp(true);
        setError("");
        setMessage("");

        const callbackResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/whatsapp/oauth/callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code, state }),
          },
        );

        if (!callbackResponse.ok) {
          const payload = await callbackResponse.json().catch(() => ({}));
          throw new Error(
            payload.error || "Failed to complete WhatsApp connection",
          );
        }

        const result = await callbackResponse.json();

        if (result.success) {
          setWhatsappPhoneNumberId(result.business.whatsappPhoneNumberId);
          setWhatsappBusinessNumber(result.business.whatsappBusinessNumber);
          setOnboarding(result.onboarding.onboarding);
          setMessage("WhatsApp connected successfully!");

          setTimeout(() => {
            void refreshOnboarding();
          }, 500);
        }

        window.history.replaceState({}, "", window.location.pathname);
      } catch (callbackError) {
        console.error("[OnboardingWizard] OAuth callback error", {
          message: callbackError.message,
        });
        setError(
          callbackError.message ||
            "Failed to complete WhatsApp connection. Please try again.",
        );
        window.history.replaceState({}, "", window.location.pathname);
      } finally {
        setIsConnectingWhatsApp(false);
      }
    };

    void handleOAuthCallback();
  }, [token, user?.businessId]);

  const refreshOnboarding = async () => {
    if (!token || !user?.businessId) return;

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/onboarding`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) return;
    const data = await response.json();
    setOnboarding(data.onboarding || data);
    if (data.onboarding?.completed) {
      updateUser((previous) => ({
        ...(previous || {}),
        onboardingCompleted: true,
        onboardingStage: "COMPLETE",
      }));
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!token || !user?.businessId) return;

    setIsConnectingWhatsApp(true);
    setError("");
    setMessage("");

    try {
      const authorizeResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/whatsapp/oauth/authorize`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!authorizeResponse.ok) {
        const payload = await authorizeResponse.json().catch(() => ({}));
        throw new Error(
          payload.error || "Failed to initialize WhatsApp connection",
        );
      }

      const { authorizeUrl } = await authorizeResponse.json();

      if (!authorizeUrl) {
        throw new Error("No authorization URL received from server");
      }

      window.location.href = authorizeUrl;
    } catch (err) {
      console.error("[OnboardingWizard] WhatsApp OAuth error", err.message);
      setError(err.message || "Failed to connect WhatsApp. Please try again.");
      setIsConnectingWhatsApp(false);
    }
  };

  const handleSave = async () => {
    if (!token || !user?.businessId) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    const normalizedPhoneId = String(whatsappPhoneNumberId || "").trim();
    const normalizedBankAccount = String(bankAccountNumber || "")
      .replace(/[^\d]/g, "")
      .trim();

    const nextCompleted =
      Boolean(normalizedPhoneId && !normalizedPhoneId.startsWith("pending_")) &&
      Boolean(bankName.trim()) &&
      Boolean(bankAccountName.trim()) &&
      Boolean(normalizedBankAccount);

    try {
      const profileResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: businessName,
            whatsappPhoneNumberId: normalizedPhoneId,
            whatsappBusinessNumber,
            customSystemPrompt,
            bankName,
            bankAccountName,
            bankAccountNumber: normalizedBankAccount,
          }),
        },
      );

      if (!profileResponse.ok) {
        const payload = await profileResponse.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save onboarding profile");
      }

      const onboardingResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/onboarding`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            completed: nextCompleted,
            stage: nextCompleted ? "COMPLETE" : "SETUP_IN_PROGRESS",
            checklist: {
              businessProfile: Boolean(businessName.trim()),
              whatsappConnection: Boolean(
                normalizedPhoneId && !normalizedPhoneId.startsWith("pending_"),
              ),
              bankDetails:
                Boolean(bankName.trim()) &&
                Boolean(bankAccountName.trim()) &&
                Boolean(normalizedBankAccount),
              aiSetup: Boolean(customSystemPrompt.trim()),
            },
          }),
        },
      );

      if (!onboardingResponse.ok) {
        const payload = await onboardingResponse.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save onboarding progress");
      }

      const onboardingPayload = await onboardingResponse.json();
      setOnboarding(onboardingPayload.onboarding || onboardingPayload);
      updateUser((previous) => ({
        ...(previous || {}),
        businessName,
        onboardingCompleted: nextCompleted,
        onboardingStage: nextCompleted ? "COMPLETE" : "SETUP_IN_PROGRESS",
        whatsappConnected: nextCompleted,
      }));
      setMessage(
        nextCompleted
          ? "Setup complete. You can now enter the dashboard."
          : normalizedPhoneId && !normalizedPhoneId.startsWith("pending_")
            ? "Progress saved. Complete the remaining steps to go live."
            : "Progress saved. Connect WhatsApp once and we will link your workspace automatically after the first webhook event.",
      );
    } catch (saveError) {
      console.error("[OnboardingWizard] Save error", saveError.message);
      setError(saveError.message || "Could not save onboarding data");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="app-navbar sticky top-0 z-40">
        <div className="app-navbar-inner">
          <div>
            <p className="brand-mark">Whats_CSR</p>
            <h1 className="text-base font-semibold text-slate-900 md:text-xl">
              Welcome, {businessName || user?.businessName || "Business"}
            </h1>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("authUser");
              window.location.replace("/");
            }}
          >
            <AppIcon name="logout" className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="app-layout onboarding-layout">
        <aside className="sidebar-card">
          <div className="section-heading">
            <h2>Setup checklist</h2>
            <p>Finish these steps to unlock the dashboard.</p>
          </div>

          <div className="mt-4 space-y-3">
            {onboardingSteps.map((step) => {
              const done =
                step.key === "aiSetup"
                  ? Boolean(
                      customSystemPrompt.trim() ||
                      onboarding?.steps?.[step.key],
                    )
                  : Boolean(onboarding?.steps?.[step.key]);
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                      <AppIcon name={step.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {step.title}
                        </p>
                        <span
                          className={`badge ${done ? "" : step.optional ? "" : "warn"}`}
                        >
                          {done
                            ? "Done"
                            : step.optional
                              ? "Optional"
                              : "Pending"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="content-card">
          <div className="p-4 md:p-8 space-y-6">
            <div className="section-heading">
              <h2>Set up your workspace</h2>
              <p>
                Complete these details once. We’ll take you to the dashboard
                when the required pieces are ready.
              </p>
            </div>

            {isLoading ? (
              <p className="muted-text">Loading onboarding...</p>
            ) : null}
            {error ? <div className="status-banner error">{error}</div> : null}
            {message ? (
              <div className="status-banner success">{message}</div>
            ) : null}
            {isComplete ? (
              <div className="status-banner success">
                Your setup is complete. You can now use the dashboard.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Business name</label>
                <input
                  className="field-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Business email</label>
                <input className="field-input" value={businessEmail} disabled />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">
                  WhatsApp connection status
                </label>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {String(whatsappPhoneNumberId || "").startsWith(
                          "pending_",
                        )
                          ? "Not connected yet"
                          : "Connected"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {String(whatsappPhoneNumberId || "").startsWith(
                          "pending_",
                        )
                          ? "Connect your WhatsApp number"
                          : `Connected: ${whatsappBusinessNumber}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isConnectingWhatsApp}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                        String(whatsappPhoneNumberId || "").startsWith(
                          "pending_",
                        )
                          ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                      onClick={handleConnectWhatsApp}
                    >
                      {isConnectingWhatsApp
                        ? "Connecting..."
                        : String(whatsappPhoneNumberId || "").startsWith(
                              "pending_",
                            )
                          ? "Connect WhatsApp"
                          : "Connected"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
                  onClick={() => setShowAdvancedWhatsApp((current) => !current)}
                >
                  {showAdvancedWhatsApp
                    ? "Hide advanced options"
                    : "Show advanced options"}
                </button>
                {showAdvancedWhatsApp ? (
                  <div className="mt-3">
                    <label className="field-label">
                      Advanced: WhatsApp phone number ID
                    </label>
                    <input
                      className="field-input"
                      value={whatsappPhoneNumberId}
                      onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                      placeholder="Only use if support asks for this"
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="field-label">WhatsApp business number</label>
                <input
                  className="field-input"
                  value={whatsappBusinessNumber}
                  onChange={(e) => setWhatsappBusinessNumber(e.target.value)}
                  placeholder="Filled after connecting"
                  disabled={
                    !String(whatsappPhoneNumberId || "").startsWith("pending_")
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Bank name</label>
                <input
                  className="field-input"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. GTBank"
                />
              </div>
              <div>
                <label className="field-label">Account name</label>
                <input
                  className="field-input"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="e.g. MDJ Forge"
                />
              </div>
            </div>

            <div>
              <label className="field-label">Account number</label>
              <input
                className="field-input"
                value={bankAccountNumber}
                onChange={(e) =>
                  setBankAccountNumber(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0123456789"
                maxLength={20}
              />
            </div>

            <div>
              <label className="field-label">Custom AI prompt (optional)</label>
              <textarea
                className="field-input min-h-[140px]"
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder="Tell the AI how your business should sound..."
              />
            </div>

            <div className="panel-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={refreshOnboarding}
              >
                Refresh status
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving
                  ? "Saving..."
                  : isComplete
                    ? "Save and continue"
                    : "Save setup"}
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Next after setup
              </p>
              <p className="mt-1 text-sm text-slate-600">
                After this step, you can add products, services, draft
                approvals, trust settings, and live handoff alerts from the
                dashboard.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default OnboardingWizard;
