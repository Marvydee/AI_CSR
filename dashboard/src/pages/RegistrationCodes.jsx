import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import FieldHint from "../components/ui/FieldHint";
import { apiUrl } from "../services/apiBase.js";

const RegistrationCodes = () => {
  const { token } = useContext(AuthContext);
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");

  const fetchCodes = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/api/superadmin/invite-codes"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch access codes");

      const data = await response.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError.message || "Could not load access codes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCodes();
    }
  }, [token]);

  const handleGenerate = async () => {
    const requestedCount = Number(count);
    const boundedCount = Number.isInteger(requestedCount)
      ? Math.min(Math.max(requestedCount, 1), 20)
      : 1;

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(
        apiUrl("/api/superadmin/invite-codes/generate"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ count: boundedCount }),
        },
      );

      if (!response.ok) throw new Error("Failed to generate access code");

      const payload = await response.json();
      const newCodes = Array.isArray(payload?.codes) ? payload.codes : [];
      setCodes((previous) => [...newCodes, ...previous]);
    } catch (generateError) {
      setError(generateError.message || "Could not generate access codes");
    } finally {
      setIsGenerating(false);
    }
  };

  const summary = useMemo(() => {
    const used = codes.filter((code) => Boolean(code.usedAt)).length;
    const unused = codes.length - used;
    return { used, unused, total: codes.length };
  }, [codes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Registration Access Codes
        </h2>
        <p className="text-sm text-slate-600">
          Generate one-time codes for paid customers. Each code can be used once
          and never expires.
        </p>
      </div>

      <PageGuide
        title="Recommended process"
        steps={[
          "Generate only what you need for current sales.",
          "Share each code privately with one buyer.",
          "Refresh this page to monitor which codes are consumed.",
        ]}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-48">
            <label className="field-label">Generate Count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              className="field-input"
            />
            <FieldHint>Use 1-20 per batch to avoid mistakes.</FieldHint>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleGenerate}
            disabled={isGenerating || !token}
          >
            {isGenerating ? "Generating..." : "Generate Access Code(s)"}
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={fetchCodes}
            disabled={isLoading || !token}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.total}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Unused
          </p>
          <p className="text-2xl font-semibold text-emerald-700">
            {summary.unused}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Used</p>
          <p className="text-2xl font-semibold text-amber-700">
            {summary.used}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">
                Access Code
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">
                Used By
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {codes.map((code) => (
              <tr key={code.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-slate-900">
                  {code.code}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      code.usedAt
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {code.usedAt ? "Used" : "Unused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {code.usedByAdminEmail || code.usedByBusiness?.name || "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(code.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {codes.length === 0 ? (
          <p className="py-8 text-center text-slate-600">
            No access codes yet.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default RegistrationCodes;
