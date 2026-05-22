import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import FieldHint from "../components/ui/FieldHint";
import { apiUrl } from "../services/apiBase.js";

const defaultForm = {
  name: "",
  sku: "",
  category: "",
  description: "",
  price: "",
  currency: "NGN",
};

const ProductCatalog = () => {
  const { token, user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const businessId = user?.businessId;

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const fetchProducts = async () => {
    if (!businessId || !token) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/products`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.error("[ProductCatalog] Fetch error", fetchError.message);
      setError(fetchError.message || "Could not load products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [businessId, token]);

  const onSubmitProduct = async (event) => {
    event.preventDefault();
    if (!businessId || !token) return;

    const numericPrice = Number(form.price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError("Enter a valid price.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/products`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
            price: numericPrice,
            currency: form.currency.trim() || "NGN",
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to add product");
      }

      setForm(defaultForm);
      setMessage("Product added successfully.");
      await fetchProducts();
    } catch (saveError) {
      console.error("[ProductCatalog] Save error", saveError.message);
      setError(saveError.message || "Could not save product");
    } finally {
      setIsSaving(false);
    }
  };

  const onArchiveProduct = async (productId) => {
    if (!businessId || !token) return;

    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/products/${productId}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to archive product");
      setMessage("Product archived.");
      await fetchProducts();
    } catch (archiveError) {
      console.error("[ProductCatalog] Archive error", archiveError.message);
      setError(archiveError.message || "Could not archive product");
    }
  };

  const onUploadExcel = async () => {
    if (!importFile || !businessId || !token) {
      setError("Select an Excel file first.");
      return;
    }

    setImportStatus("Uploading...");
    setError("");
    setMessage("");
    try {
      const base64 = await toBase64(importFile);
      const response = await fetch(
        apiUrl(`/api/business/${businessId}/products/import`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: importFile.name,
            fileBase64: base64,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detailText = Array.isArray(payload.details)
          ? payload.details.join("\n")
          : payload.error;
        throw new Error(detailText || "Import failed");
      }

      setImportStatus(
        `Imported. Created: ${payload.created || 0}, Updated: ${payload.updated || 0}`,
      );
      setMessage("Product import completed.");
      await fetchProducts();
    } catch (importError) {
      console.error("[ProductCatalog] Import error", importError.message);
      setImportStatus(`Import failed: ${importError.message}`);
      setError(importError.message || "Import failed");
    }
  };

  return (
    <section className="space-y-6">
      <div className="section-heading">
        <h2>Product Catalog</h2>
        <p>
          Add products and prices so AI can respond with accurate offers in
          customer chats.
        </p>
      </div>

      <PageGuide
        title="Fastest way to keep this updated"
        steps={[
          "Use Add Product for one item at a time.",
          "Use Excel import for bulk updates.",
          "Archive products you no longer sell so AI stops mentioning them.",
        ]}
      />

      {error ? <div className="status-banner error">{error}</div> : null}
      {message ? <div className="status-banner success">{message}</div> : null}

      <form onSubmit={onSubmitProduct} className="panel-card space-y-4">
        <h3 className="font-semibold text-slate-900">Add Product</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Product Name</label>
            <input
              className="field-input"
              placeholder="Product name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="field-label">SKU (Optional)</label>
            <input
              className="field-input"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sku: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="field-label">Category</label>
            <input
              className="field-input"
              placeholder="Category"
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
            />
            <FieldHint>Optional but useful for better AI grouping.</FieldHint>
          </div>
          <div>
            <label className="field-label">Price and Currency</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                className="field-input w-full"
                placeholder="Price"
                value={form.price}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, price: e.target.value }))
                }
                required
              />
              <input
                className="field-input w-24"
                placeholder="NGN"
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
          <label className="field-label">Description</label>
          <textarea
            className="field-input"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>
        <button type="submit" disabled={isSaving} className="primary-button">
          {isSaving ? "Saving..." : "Add Product"}
        </button>
      </form>

      <div className="panel-card space-y-3">
        <h3 className="font-semibold text-slate-900">Import from Excel</h3>
        <p className="text-xs text-slate-600">
          Required columns: Name and Price. Optional: Description, Category,
          SKU, Currency, Active.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="button"
          onClick={onUploadExcel}
          className="secondary-button"
        >
          Import Excel File
        </button>
        {importStatus ? (
          <p className="text-sm text-slate-700">{importStatus}</p>
        ) : null}
      </div>

      <div className="panel-card">
        <h3 className="font-semibold text-slate-900 mb-4">Current Products</h3>
        {isLoading ? (
          <p className="muted-text">Loading products...</p>
        ) : sortedProducts.length === 0 ? (
          <p className="muted-text">No active products yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedProducts.map((product) => (
              <div
                key={product.id}
                className="border border-slate-200 rounded p-3 flex justify-between items-start"
              >
                <div>
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-600">
                    {Number(product.price).toFixed(2)} {product.currency}
                    {product.category ? ` • ${product.category}` : ""}
                    {product.sku ? ` • SKU: ${product.sku}` : ""}
                  </p>
                  {product.description ? (
                    <p className="text-xs text-slate-500 mt-1">
                      {product.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onArchiveProduct(product.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Archive
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export default ProductCatalog;
