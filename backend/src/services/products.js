import XLSX from "xlsx";

const KNOWN_NAME_HEADERS = ["name", "product", "product name", "item"];
const KNOWN_PRICE_HEADERS = ["price", "amount", "unit price", "cost"];

const findHeader = (row, candidates) => {
  const keys = Object.keys(row || {});
  for (const key of keys) {
    const normalized = String(key).trim().toLowerCase();
    if (candidates.includes(normalized)) {
      return key;
    }
  }
  return null;
};

const normalizeCurrency = (value) => {
  if (!value) return "NGN";
  return String(value).trim().toUpperCase().slice(0, 8) || "NGN";
};

const normalizeBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === "")
    return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "active", "y"].includes(normalized);
};

const normalizePrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Number(numeric.toFixed(2));
};

const buildTrainingProducts = (products) =>
  products.map((product) => ({
    name: product.name,
    price: Number(product.price),
    currency: product.currency,
    category: product.category || null,
    sku: product.sku || null,
    description: product.description || null,
  }));

const buildPriceList = (products) => {
  const result = {};
  for (const product of products) {
    result[product.name] =
      `${Number(product.price).toFixed(2)} ${product.currency}`;
  }
  return result;
};

export const syncProductTrainingData = async (prisma, businessId) => {
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { aiTrainingData: true },
  });

  const existing =
    business?.aiTrainingData && typeof business.aiTrainingData === "object"
      ? business.aiTrainingData
      : {};

  await prisma.business.update({
    where: { id: businessId },
    data: {
      aiTrainingData: {
        ...existing,
        products: buildTrainingProducts(products),
        prices: {
          ...(existing.prices && typeof existing.prices === "object"
            ? existing.prices
            : {}),
          ...buildPriceList(products),
        },
      },
    },
  });
};

export const parseProductsFromExcelBase64 = ({ fileBase64, fileName }) => {
  const errors = [];
  if (!fileBase64) {
    return { rows: [], errors: ["fileBase64 is required"] };
  }

  let workbook;
  try {
    const raw = fileBase64.includes(",")
      ? fileBase64.split(",").pop()
      : fileBase64;
    const buffer = Buffer.from(raw, "base64");
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (error) {
    return { rows: [], errors: [`Invalid Excel file: ${error.message}`] };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { rows: [], errors: ["Excel file has no worksheet"] };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: "",
    raw: false,
  });

  const parsedRows = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const nameHeader = findHeader(row, KNOWN_NAME_HEADERS);
    const priceHeader = findHeader(row, KNOWN_PRICE_HEADERS);

    if (!nameHeader || !priceHeader) {
      errors.push("Sheet must include Name and Price columns");
      return;
    }

    const name = String(row[nameHeader] || "").trim();
    const price = normalizePrice(row[priceHeader]);

    if (!name) {
      errors.push(`Row ${rowNumber}: product name is required`);
      return;
    }

    if (price === null) {
      errors.push(`Row ${rowNumber}: valid price is required`);
      return;
    }

    parsedRows.push({
      name,
      price,
      description:
        String(row.Description || row.description || "").trim() || null,
      category: String(row.Category || row.category || "").trim() || null,
      sku: String(row.SKU || row.sku || "").trim() || null,
      currency: normalizeCurrency(row.Currency || row.currency || "NGN"),
      isActive: normalizeBoolean(row.Active || row.active || "true"),
    });
  });

  if (!rows.length) {
    errors.push(`No rows found in ${fileName || "uploaded workbook"}`);
  }

  return { rows: parsedRows, errors };
};
