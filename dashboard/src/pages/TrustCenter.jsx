import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const toggleOptions = ["AI_FULL", "AI_ASK", "HUMAN_ONLY"];

const TrustCenter = () => {
  const { token, user } = useContext(AuthContext);
  const [toggles, setToggles] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchToggles = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/toggles?businessId=${user?.businessId || ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch toggles");
        const data = await response.json();
        setToggles(data);
      } catch (error) {
        console.error("[TrustCenter] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchToggles();
  }, [token]);

  const handleToggleChange = async (key, value) => {
    setToggles((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/toggles/${key}?businessId=${user?.businessId || ""}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ value }),
        },
      );

      if (!response.ok) throw new Error("Failed to update toggle");
    } catch (error) {
      console.error("[TrustCenter] Update error", error.message);
      alert("Error updating toggle");
    }
  };

  const toggleConfig = [
    {
      key: "togglePaymentDetails",
      label: "Sharing Bank/Payment Details",
      description:
        "Whether AI can discuss payment methods and account information.",
    },
    {
      key: "togglePriceQuotes",
      label: "Quoting Prices",
      description: "Whether AI can automatically provide price quotes.",
    },
    {
      key: "toggleBookingConfirmation",
      label: "Confirming Bookings",
      description: "Whether AI can confirm appointments and reservations.",
    },
    {
      key: "toggleFirstCustomerMessage",
      label: "New Customer First Messages",
      description: "How to handle first-time customer inquiries.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Trust Center
        </h2>
        <p className="text-sm text-slate-600">
          Control when the AI can act autonomously (AI_FULL), needs your
          approval (AI_ASK), or must hand off to you (HUMAN_ONLY).
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Loading toggles...</p>
      ) : (
        <div className="space-y-4">
          {toggleConfig.map(({ key, label, description }) => (
            <div
              key={key}
              className="bg-white rounded-lg p-6 border border-slate-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{label}</h3>
                  <p className="text-sm text-slate-600 mt-1">{description}</p>
                </div>
                <select
                  value={toggles[key] || "AI_ASK"}
                  onChange={(e) => handleToggleChange(key, e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1 text-sm"
                >
                  {toggleOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <p>
                  <strong>AI_FULL:</strong> AI replies immediately.
                </p>
                <p>
                  <strong>AI_ASK:</strong> AI drafts, you approve first.
                </p>
                <p>
                  <strong>HUMAN_ONLY:</strong> Always hand off to you.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrustCenter;
