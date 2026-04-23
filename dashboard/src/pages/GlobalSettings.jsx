import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const GlobalSettings = () => {
  const { token } = useContext(AuthContext);
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    errorRate: "0%",
    averageResponseTime: "0ms",
    groqApiUsage: "0",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/superadmin/metrics`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch metrics");
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error("[GlobalSettings] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Global Settings & Monitoring
        </h2>
        <p className="text-sm text-slate-600">
          Monitor platform health and API usage.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Loading metrics...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">
              Total Webhook Requests
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {metrics.totalRequests}
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Error Rate</p>
            <p className="text-3xl font-bold text-red-600">
              {metrics.errorRate}
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Avg Response Time</p>
            <p className="text-3xl font-bold text-slate-900">
              {metrics.averageResponseTime}
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">Groq API Requests</p>
            <p className="text-3xl font-bold text-slate-900">
              {metrics.groqApiUsage}
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Monitor error logs in the Switchboard to
          identify tenant issues.
        </p>
      </div>
    </div>
  );
};

export default GlobalSettings;
