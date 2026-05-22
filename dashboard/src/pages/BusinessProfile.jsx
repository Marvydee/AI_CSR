import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import FieldHint from "../components/ui/FieldHint";
import { apiUrl } from "../services/apiBase.js";

const BusinessProfile = () => {
  const { token, user } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [whatsappBusinessNumber, setWhatsappBusinessNumber] = useState("");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token || !user?.businessId) return;

      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(
          apiUrl(`/api/business/${user.businessId}/profile`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch business profile");
        const data = await response.json();
        setName(data.name || "");
        setEmail(data.email || "");
        setWhatsappPhoneNumberId(data.whatsappPhoneNumberId || "");
        setWhatsappBusinessNumber(data.whatsappBusinessNumber || "");
        setCustomSystemPrompt(data.customSystemPrompt || "");
        setBankName(data.bankName || "");
        setBankAccountName(data.bankAccountName || "");
        setBankAccountNumber(data.bankAccountNumber || "");
      } catch (fetchError) {
        console.error("[BusinessProfile] Fetch error", fetchError.message);
        setError(fetchError.message || "Could not load business profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token, user?.businessId]);

  const handleSave = async () => {
    if (!token || !user?.businessId) return;

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${user.businessId}/profile`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: String(name || "").trim(),
            whatsappPhoneNumberId: String(whatsappPhoneNumberId || "").trim(),
            whatsappBusinessNumber: String(whatsappBusinessNumber || "").trim(),
            customSystemPrompt,
            bankName: String(bankName || "").trim(),
            bankAccountName: String(bankAccountName || "").trim(),
            bankAccountNumber: String(bankAccountNumber || "").replace(
              /[^\d]/g,
              "",
            ),
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save profile");
      }

      setMessage("Business profile saved successfully.");
    } catch (saveError) {
      console.error("[BusinessProfile] Save error", saveError.message);
      setError(saveError.message || "Could not save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="section-heading">
        <h2>Business Profile</h2>
        <p>
          Keep this information accurate so AI replies, alerts, and payout flows
          work correctly.
        </p>
      </div>

      <PageGuide
        title="Before you save"
        steps={[
          "Use the exact WhatsApp number ID provided by Meta.",
          "Use digits only for bank account number.",
          "Keep AI prompt optional and focused on tone and policy.",
        ]}
      />

      {error ? <div className="status-banner error">{error}</div> : null}
      {message ? <div className="status-banner success">{message}</div> : null}

      <div className="panel-card space-y-4">
        {isLoading ? (
          <p className="muted-text">Loading profile...</p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Business Name</label>
                <input
                  className="field-input"
                  placeholder="Business name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <FieldHint>This name appears across your workspace.</FieldHint>
              </div>
              <div>
                <label className="field-label">Business Email</label>
                <input
                  className="field-input"
                  placeholder="Business email"
                  value={email}
                  disabled
                />
                <FieldHint>Email is managed from account settings.</FieldHint>
              </div>
            </div>

            <div>
              <label className="field-label">
                Meta WhatsApp Phone Number ID
              </label>
              <input
                className="field-input"
                placeholder="Meta WhatsApp phone number ID"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
              />
              <FieldHint>
                Required for sending replies and processing webhook messages.
              </FieldHint>
            </div>

            <div>
              <label className="field-label">Owner WhatsApp Number</label>
              <input
                className="field-input"
                placeholder="Owner WhatsApp number for handoff alerts"
                value={whatsappBusinessNumber}
                onChange={(e) => setWhatsappBusinessNumber(e.target.value)}
              />
              <FieldHint>
                This receives handoff and draft review notifications.
              </FieldHint>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Bank Name</label>
                <input
                  className="field-input"
                  placeholder="Bank name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Account Name</label>
                <input
                  className="field-input"
                  placeholder="Account name"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="field-label">Account Number</label>
              <input
                className="field-input"
                placeholder="Account number"
                value={bankAccountNumber}
                onChange={(e) =>
                  setBankAccountNumber(e.target.value.replace(/[^\d]/g, ""))
                }
                maxLength={20}
              />
              <FieldHint>
                Digits only. Spaces and symbols are removed automatically.
              </FieldHint>
            </div>

            <div>
              <label className="field-label">Custom AI Prompt (Optional)</label>
              <textarea
                className="field-input"
                rows={5}
                placeholder="Tell AI your tone, policies, and preferred style"
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
              />
              <FieldHint>
                Example: Keep replies short, polite, and ask clarifying
                questions first.
              </FieldHint>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="primary-button"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default BusinessProfile;
