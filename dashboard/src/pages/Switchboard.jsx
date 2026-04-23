import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const Switchboard = () => {
  const { token } = useContext(AuthContext);
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBusinesses = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/superadmin/tenants`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch tenants");
        const data = await response.json();
        setBusinesses(data);
      } catch (error) {
        console.error("[Switchboard] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchBusinesses();
  }, [token]);

  const handleTogglePause = async (businessId, currentState) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/superadmin/tenants/${businessId}/pause`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isPaused: !currentState }),
        },
      );

      if (!response.ok) throw new Error("Failed to update tenant status");

      setBusinesses((prev) =>
        prev.map((biz) =>
          biz.id === businessId ? { ...biz, isPaused: !currentState } : biz,
        ),
      );
    } catch (error) {
      console.error("[Switchboard] Toggle error", error.message);
      alert("Error updating tenant status");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Switchboard
        </h2>
        <p className="text-sm text-slate-600">
          Instantly pause any tenant's bot (e.g., for maintenance or abuse).
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Loading tenants...</p>
      ) : (
        <div className="space-y-3">
          {businesses.map((biz) => (
            <div
              key={biz.id}
              className="bg-white rounded-lg p-4 border border-slate-200 flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold text-slate-900">{biz.name}</h3>
                <p className="text-sm text-slate-600">{biz.email}</p>
              </div>
              <button
                onClick={() => handleTogglePause(biz.id, biz.isPaused)}
                className={`px-4 py-2 rounded font-medium text-sm transition ${
                  biz.isPaused
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {biz.isPaused ? "Resume" : "Pause"}
              </button>
            </div>
          ))}

          {businesses.length === 0 && (
            <p className="text-center py-8 text-slate-600">No tenants found</p>
          )}
        </div>
      )}

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">
          <strong>Warning:</strong> Pausing a tenant will immediately stop their
          bot from processing new messages.
        </p>
      </div>
    </div>
  );
};

export default Switchboard;
