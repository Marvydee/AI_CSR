import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token || !user?.businessId) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/profile`,
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
      } catch (error) {
        console.error("[BusinessProfile] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token, user?.businessId]);

  const handleSave = async () => {
    if (!token || !user?.businessId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            whatsappPhoneNumberId,
            whatsappBusinessNumber,
            customSystemPrompt,
            bankName,
            bankAccountName,
            bankAccountNumber,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to save profile");
      }

      alert("Business profile saved successfully.");
    } catch (error) {
      console.error("[BusinessProfile] Save error", error.message);
      alert(error.message || "Could not save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Business Profile
        </h2>
        <p className="text-sm text-slate-600">
          Set the business details used by the AI and the WhatsApp template
          owner alerts.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        {isLoading ? (
          <p className="text-slate-600 text-sm">Loading profile...</p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                className="border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Business name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Business email"
                value={email}
                disabled
              />
            </div>
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Meta WhatsApp phone number ID"
              value={whatsappPhoneNumberId}
              onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
            />
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Owner WhatsApp number for handoff alerts"
              value={whatsappBusinessNumber}
              onChange={(e) => setWhatsappBusinessNumber(e.target.value)}
            />
            <div className="grid md:grid-cols-2 gap-4">
              <input
                className="border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Bank name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <input
                className="border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Account name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
            </div>
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Account number"
              value={bankAccountNumber}
              onChange={(e) =>
                setBankAccountNumber(e.target.value.replace(/[^\d]/g, ""))
              }
              maxLength={20}
            />
            <textarea
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              rows={5}
              placeholder="Custom system prompt (optional)"
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessProfile;
