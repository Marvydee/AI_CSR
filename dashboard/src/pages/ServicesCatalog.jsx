import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import { apiUrl } from "../services/apiBase.js";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
        apiUrl(`/api/business/${businessId}/services`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch services");
      const payload = await response.json();
      setServices(Array.isArray(payload) ? payload : []);
    } catch (fetchError) {
      console.error("[ServicesCatalog] Fetch error", fetchError.message);
      setError(fetchError.message || "Could not fetch services");
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
      setError("Enter a valid base price.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/services`),
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
      setMessage("Service added successfully.");
      await fetchServices();
    } catch (saveError) {
      console.error("[ServicesCatalog] Save error", saveError.message);
      setError(saveError.message || "Could not save service");
    } finally {
      setIsSaving(false);
    }
  };

  const onArchiveService = async (serviceId) => {
    if (!businessId || !token) return;

    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/services/${serviceId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to remove service");
      setMessage("Service removed.");
      await fetchServices();
    } catch (deleteError) {
      console.error("[ServicesCatalog] Delete error", deleteError.message);
      setError(deleteError.message || "Could not remove service");
    }
  };

  return (
    <section className="space-y-6">
      <div className="section-heading">
        <h2>Services Catalog</h2>
        <p>
          Add service offers and base prices so AI can quote your services
          clearly.
        </p>
      </div>

      <PageGuide
        title="Simple setup"
        steps={[
          "Add each service with a clear name.",
          "Set a realistic base price and currency.",
          "Remove old services to keep AI suggestions accurate.",
        ]}
      />

      {error ? <div className="status-banner error">{error}</div> : null}
      {message ? <div className="status-banner success">{message}</div> : null}

      <form onSubmit={onSubmitService} className="panel-card space-y-4">
        <h3 className="font-semibold text-slate-900">Add Service</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Service Name</label>
            <input
              className="field-input"
              placeholder="Service name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="field-label">Base Price and Currency</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                className="field-input w-full"
                placeholder="Base price"
                value={form.basePrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, basePrice: e.target.value }))
                }
                required
              />
              <input
                className="field-input w-24"
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
        </div>
        <div>
          <label className="field-label">Service Description</label>
          <textarea
            className="field-input"
            rows={3}
            placeholder="Service description"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>
        <button type="submit" disabled={isSaving} className="primary-button">
          {isSaving ? "Saving..." : "Add Service"}
        </button>
      </form>

      <div className="panel-card">
        <h3 className="font-semibold text-slate-900 mb-4">Current Services</h3>
        {isLoading ? (
          <p className="muted-text">Loading services...</p>
        ) : sortedServices.length === 0 ? (
          <p className="muted-text">No services yet.</p>
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
    </section>
  );
};

export default ServicesCatalog;
