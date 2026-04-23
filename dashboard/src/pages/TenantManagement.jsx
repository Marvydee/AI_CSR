import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const TenantManagement = () => {
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
        console.error("[TenantManagement] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchBusinesses();
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Tenant Management
        </h2>
        <p className="text-sm text-slate-600">
          View and manage all registered businesses.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-600">Loading tenants...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Business
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Setup
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Subscription
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-900">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {businesses.map((biz) => (
                <tr key={biz.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {biz.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{biz.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        biz.onboardingCompleted
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {biz.onboardingCompleted
                        ? "Live"
                        : biz.onboardingStage || "Onboarding"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        biz.isPaused
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {biz.isPaused ? "Paused" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {biz.subscriptionStatus}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(biz.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {businesses.length === 0 && (
            <p className="text-center py-8 text-slate-600">No tenants found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TenantManagement;
