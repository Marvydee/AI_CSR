import React, { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";

const HandoffAlerts = () => {
  const { token, user } = useContext(AuthContext);
  const [handoffs, setHandoffs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const knownHandoffIdsRef = useRef(new Set());

  const playAlertTone = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(900, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      650,
      ctx.currentTime + 0.25,
    );

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  };

  const notifyOwner = (newCount) => {
    if (newCount <= 0) return;

    playAlertTone();

    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("New Handoff Alert", {
          body: `${newCount} customer conversation(s) need human attention`,
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const fetchHandoffs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/business/handoffs?businessId=${user?.businessId || ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch handoffs");
        const data = await response.json();
        const nextHandoffs = Array.isArray(data) ? data : [];

        const known = knownHandoffIdsRef.current;
        const incomingIds = nextHandoffs.map((handoff) => handoff.id);
        const newIds = incomingIds.filter((id) => !known.has(id));

        if (known.size > 0) {
          notifyOwner(newIds.length);
        }

        knownHandoffIdsRef.current = new Set(incomingIds);
        setHandoffs(nextHandoffs);
      } catch (error) {
        console.error("[HandoffAlerts] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchHandoffs();
      const interval = setInterval(fetchHandoffs, 30000);
      return () => clearInterval(interval);
    }
  }, [token, user?.businessId]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Handoff Alerts</h2>
      <p className="text-sm text-slate-600">
        Chats that need your immediate attention (customer asked for human or
        toggle requires handoff).
      </p>

      {isLoading ? (
        <p className="text-slate-600">Loading handoffs...</p>
      ) : handoffs.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700 font-medium">
            All quiet! No pending handoffs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {handoffs.map((handoff) => (
            <div
              key={handoff.id}
              className="bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-red-900">
                    {handoff.customer?.name || handoff.customerWaId}
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {handoff.humanReason}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    {new Date(handoff.lastMessageAt).toLocaleString()}
                  </p>
                </div>
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  onClick={() => {
                    alert(
                      "Opening chat with " +
                        (handoff.customer?.name || handoff.customerWaId),
                    );
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HandoffAlerts;
