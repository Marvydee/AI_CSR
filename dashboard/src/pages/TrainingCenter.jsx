import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const TrainingCenter = () => {
  const { token, user } = useContext(AuthContext);
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState({});
  const [faqs, setFaqs] = useState([]);
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpDelayHours, setFollowUpDelayHours] = useState(24);
  const [followUpMessage, setFollowUpMessage] = useState(
    "Hi {{name}}, just checking in. Would you like me to help you get started?",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [followUpQueue, setFollowUpQueue] = useState([]);

  useEffect(() => {
    const fetchTraining = async () => {
      if (!user?.businessId || !token) return;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/training`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) return;
        const payload = await response.json();
        const training = payload.aiTrainingData || {};

        setServices(Array.isArray(training.services) ? training.services : []);
        setPrices(
          training.prices && typeof training.prices === "object"
            ? training.prices
            : {},
        );
        setFaqs(Array.isArray(training.faqs) ? training.faqs : []);
        setFollowUpEnabled(
          typeof training.followUpEnabled === "boolean"
            ? training.followUpEnabled
            : true,
        );
        setFollowUpDelayHours(
          Number.isFinite(Number(training.followUpDelayHours))
            ? Number(training.followUpDelayHours)
            : 24,
        );
        setFollowUpMessage(
          typeof training.followUpMessage === "string" &&
            training.followUpMessage.trim()
            ? training.followUpMessage
            : "Hi {{name}}, just checking in. Would you like me to help you get started?",
        );
      } catch (error) {
        console.error("[Training] Fetch error", error.message);
      }
    };

    fetchTraining();
  }, [token, user?.businessId]);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!user?.businessId || !token) return;

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/follow-ups/queue?businessId=${user.businessId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) return;
        const payload = await response.json();
        setFollowUpQueue(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("[Training] Queue fetch error", error.message);
      }
    };

    fetchQueue();
  }, [token, user?.businessId]);

  const handleSaveTraining = async () => {
    if (!user?.businessId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${user.businessId}/training`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            services,
            prices,
            faqs,
            followUpEnabled,
            followUpDelayHours,
            followUpMessage,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to save training data");
      alert("AI training data saved successfully!");
    } catch (error) {
      console.error("[Training] Save error", error.message);
      alert("Error saving training data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunFollowUpScan = async () => {
    if (!user?.businessId || !token) return;

    setIsRunningScan(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/follow-ups/run?businessId=${user.businessId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to run follow-up scan");
      const payload = await response.json();
      alert(
        `Follow-up scan complete. Remaining queue: ${payload.remainingQueue || 0}`,
      );
    } catch (error) {
      console.error("[Training] Follow-up scan error", error.message);
      alert(error.message || "Could not run follow-up scan");
    } finally {
      setIsRunningScan(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">
        AI Training Center
      </h2>
      <p className="text-sm text-slate-600">
        Teach the AI about your business. More details = Better replies.
      </p>

      <div className="bg-white rounded-lg p-6 border border-slate-200">
        <label className="block mb-2 font-medium text-slate-900">
          Services
        </label>
        <textarea
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          rows="3"
          placeholder="e.g., Plumbing, Electrical, General Repairs"
          value={services.join(", ")}
          onChange={(e) => setServices(e.target.value.split(", "))}
        />
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200">
        <label className="block mb-2 font-medium text-slate-900">Pricing</label>
        <textarea
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          rows="3"
          placeholder="e.g., Basic service: ₦5,000, Premium: ₦10,000"
          value={JSON.stringify(prices, null, 2)}
          onChange={(e) => {
            try {
              setPrices(JSON.parse(e.target.value));
            } catch {}
          }}
        />
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200">
        <label className="block mb-2 font-medium text-slate-900">FAQs</label>
        <textarea
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          rows="4"
          placeholder="Q: Hours? A: Mon-Fri 9am-6pm&#10;Q: Warranty? A: 6 months"
          value={faqs
            .map((item) =>
              typeof item === "string"
                ? item
                : `Q: ${item.q || ""} A: ${item.a || ""}`,
            )
            .join("\n")}
          onChange={(e) => setFaqs(e.target.value.split("\n").filter(Boolean))}
        />
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-4">
        <h3 className="font-semibold text-slate-900">Sales Follow-Up</h3>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={followUpEnabled}
            onChange={(e) => setFollowUpEnabled(e.target.checked)}
          />
          <span className="text-sm text-slate-700">
            Enable automatic follow-up for inactive leads
          </span>
        </div>
        <input
          type="number"
          min="1"
          max="168"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          value={followUpDelayHours}
          onChange={(e) => setFollowUpDelayHours(Number(e.target.value))}
        />
        <textarea
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          rows="3"
          placeholder="Follow-up message"
          value={followUpMessage}
          onChange={(e) => setFollowUpMessage(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          You can use <code>{"{{name}}"}</code> to personalize the message.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRunFollowUpScan}
            disabled={isRunningScan}
            className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {isRunningScan ? "Running Scan..." : "Run Follow-Up Scan Now"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-900">Follow-Up Queue</h3>
        {followUpQueue.length === 0 ? (
          <p className="text-sm text-slate-600">
            No customers are currently due for a follow-up.
          </p>
        ) : (
          <div className="space-y-2">
            {followUpQueue.map((item) => (
              <div
                key={item.conversationId}
                className="border border-slate-200 rounded p-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.customerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.businessName} • Due after {item.followUpDelayHours}h •
                    Last message:{" "}
                    {new Date(item.lastMessageAt).toLocaleString()}
                  </p>
                </div>
                <span className="badge warn">Queued</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSaveTraining}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Save Training Data"}
      </button>
    </div>
  );
};

export default TrainingCenter;
