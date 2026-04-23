import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

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
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/products`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("[ProductCatalog] Fetch error", error.message);
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
      alert("Enter a valid price");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/products`,
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
      await fetchProducts();
    } catch (error) {
      console.error("[ProductCatalog] Save error", error.message);
      alert(error.message || "Could not save product");
    } finally {
      setIsSaving(false);
    }
  };

  const onArchiveProduct = async (productId) => {
    if (!businessId || !token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/products/${productId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to archive product");
      await fetchProducts();
    } catch (error) {
      console.error("[ProductCatalog] Archive error", error.message);
      alert("Could not archive product");
    }
  };

  const onUploadExcel = async () => {
    if (!importFile || !businessId || !token) {
      alert("Select an Excel file first");
      return;
    }

    setImportStatus("Uploading...");
    try {
      const base64 = await toBase64(importFile);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/${businessId}/products/import`,
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
      await fetchProducts();
    } catch (error) {
      console.error("[ProductCatalog] Import error", error.message);
      setImportStatus(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Product Catalog
        </h2>
        <p className="text-sm text-slate-600">
          Add products with pricing or import from Excel. The AI will use this
          live catalog when answering customer questions.
        </p>
      </div>

      <form
        onSubmit={onSubmitProduct}
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
      >
        <h3 className="font-semibold text-slate-900">Add Product</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="Product name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <input
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="SKU (optional)"
            value={form.sku}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sku: e.target.value }))
            }
          />
          <input
            className="border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
              placeholder="Price"
              value={form.price}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, price: e.target.value }))
              }
              required
            />
            <input
              className="border border-slate-300 rounded px-3 py-2 text-sm w-24"
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
        <textarea
          className="border border-slate-300 rounded px-3 py-2 text-sm w-full"
          placeholder="Description"
          rows={3}
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
          {isSaving ? "Saving..." : "Add Product"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-slate-900">Import from Excel</h3>
        <p className="text-xs text-slate-600">
          Required columns: Name, Price. Optional: Description, Category, SKU,
          Currency, Active.
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
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700"
        >
          Import Excel File
        </button>
        {importStatus ? (
          <p className="text-sm text-slate-700">{importStatus}</p>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Current Products</h3>
        {isLoading ? (
          <p className="text-slate-600 text-sm">Loading products...</p>
        ) : sortedProducts.length === 0 ? (
          <p className="text-slate-600 text-sm">No active products yet.</p>
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
    </div>
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
