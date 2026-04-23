import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const defaultForm = {
  name: "",
  description: "",
  basePrice: "",
  currency: "NGN",
};

const ServicesCatalog = () => {
  const { token, user } = useContext(AuthContext);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const businessId = user?.businessId;

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      ),
    [services],
  );

  const fetchServices = async () => {
    if (!businessId || !token) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/services`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch services");
      const payload = await response.json();
      setServices(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("[ServicesCatalog] Fetch error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [businessId, token]);

  const onSubmitService = async (event) => {
    event.preventDefault();
    if (!businessId || !token) return;

    const numericPrice = Number(form.basePrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      alert("Enter a valid base price");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            basePrice: numericPrice,
            currency: form.currency.trim().toUpperCase() || "NGN",
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to add service");
      }

      setForm(defaultForm);
      await fetchServices();
    } catch (error) {
      console.error("[ServicesCatalog] Save error", error.message);
      alert(error.message || "Could not save service");
    } finally {
      setIsSaving(false);
    }
  };

  const onArchiveService = async (serviceId) => {
    if (!businessId || !token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/services/${serviceId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to remove service");
      await fetchServices();
    } catch (error) {
      console.error("[ServicesCatalog] Delete error", error.message);
      alert("Could not remove service");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Services Catalog
        </h2>
        <p className="text-sm text-slate-600">
          Add your business services with base pricing so the AI can answer
          service requests clearly.
        </p>
      </div>

      <form
        onSubmit={onSubmitService}
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
      >
        <h3 className="font-semibold text-slate-900">Add Service</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="Service name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Base price"
              value={form.basePrice}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, basePrice: e.target.value }))
              }
              required
            />
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm w-24"
              value={form.currency}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  currency: e.target.value.toUpperCase(),
                }))
              }
            />
          </div>
        </div>
        <textarea
          className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
          rows={3}
          placeholder="Service description"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
        />
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Add Service"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Current Services</h3>
        {isLoading ? (
          <p className="text-slate-600 text-sm">Loading services...</p>
        ) : sortedServices.length === 0 ? (
          <p className="text-slate-600 text-sm">No services yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedServices.map((service) => (
              <div
                key={service.id}
                className="border border-slate-200 rounded p-3 flex justify-between items-start"
              >
                <div>
                  <p className="font-medium text-slate-900">{service.name}</p>
                  <p className="text-sm text-slate-600">
                    {Number(service.basePrice || 0).toFixed(2)}{" "}
                    {service.currency || "NGN"}
                  </p>
                  {service.description ? (
                    <p className="text-xs text-slate-500 mt-1">
                      {service.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onArchiveService(service.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesCatalog;
