import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import FieldHint from "../components/ui/FieldHint";
import { apiUrl } from "../services/apiBase.js";

const DEFAULT_FOLLOW_UP_MESSAGE =
  "Hi {{name}}, just checking in. Would you like me to help you get started?";
const DEFAULT_TRAINING_DESCRIPTION =
  "Describe what your business does so the AI stays focused on your niche.";
const DEFAULT_TRAINING_TONE = "professional";

const parseServicesInput = (value) =>
  String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseFaqInput = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^q:\s*(.*?)\s*a:\s*(.*)$/i);
      if (!match) return line;
      return {
        q: match[1]?.trim() || "",
        a: match[2]?.trim() || "",
      };
    });

const parsePricingInput = (value) => {
  const text = String(value || "").trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Intentionally fall through to line-based format parsing.
  }

  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split(":");
      const label = String(key || "").trim();
      const valueText = String(rest.join(":") || "").trim();
      if (!label || !valueText) return null;
      return [label, valueText];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
};

const toFaqText = (faqs = []) =>
  faqs
    .map((item) =>
      typeof item === "string" ? item : `Q: ${item.q || ""} A: ${item.a || ""}`,
    )
    .join("\n");

const toRestrictionsText = (restrictions = []) =>
  Array.isArray(restrictions) ? restrictions.join("\n") : "";

const TrainingCenter = () => {
  const { token, user } = useContext(AuthContext);
  const [servicesInput, setServicesInput] = useState("");
  const [pricingInput, setPricingInput] = useState("{}");
  const [faqInput, setFaqInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState(
    DEFAULT_TRAINING_DESCRIPTION,
  );
  const [toneInput, setToneInput] = useState(DEFAULT_TRAINING_TONE);
  const [restrictionsInput, setRestrictionsInput] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpDelayHours, setFollowUpDelayHours] = useState(24);
  const [followUpMessage, setFollowUpMessage] = useState(
    DEFAULT_FOLLOW_UP_MESSAGE,
  );
  const [imageAnalysisEnabled, setImageAnalysisEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [followUpQueue, setFollowUpQueue] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchTraining = async () => {
      if (!user?.businessId || !token) return;

      try {
        const response = await fetch(
          apiUrl(`/api/business/${user.businessId}/training`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) return;
        const payload = await response.json();
        const training = payload.aiTrainingData || {};

        setServicesInput((training.services || []).join(", "));
        setDescriptionInput(
          typeof training.description === "string" &&
            training.description.trim()
            ? training.description
            : DEFAULT_TRAINING_DESCRIPTION,
        );
        setToneInput(
          typeof training.tone === "string" && training.tone.trim()
            ? training.tone.trim().toLowerCase()
            : DEFAULT_TRAINING_TONE,
        );
        setPricingInput(
          JSON.stringify(
            training.prices && typeof training.prices === "object"
              ? training.prices
              : {},
            null,
            2,
          ),
        );
        setFaqInput(
          toFaqText(Array.isArray(training.faqs) ? training.faqs : []),
        );
        setRestrictionsInput(
          toRestrictionsText(
            Array.isArray(training.restrictions) ? training.restrictions : [],
          ),
        );
        setFollowUpEnabled(
          typeof training.followUpEnabled === "boolean"
            ? training.followUpEnabled
            : true,
        );
        setFollowUpDelayHours(
          Number.isFinite(Number(training.followUpDelayHours))
            ? Number(training.followUpDelayHours)
            : 24,
        );
        setFollowUpMessage(
          typeof training.followUpMessage === "string" &&
            training.followUpMessage.trim()
            ? training.followUpMessage
            : DEFAULT_FOLLOW_UP_MESSAGE,
        );
        setImageAnalysisEnabled(
          typeof training.imageAnalysisEnabled === "boolean"
            ? training.imageAnalysisEnabled
            : true,
        );
      } catch (fetchError) {
        console.error("[Training] Fetch error", fetchError.message);
      }
    };

    fetchTraining();
  }, [token, user?.businessId]);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!user?.businessId || !token) return;

      try {
        const response = await fetch(
          apiUrl(
            `/api/business/follow-ups/queue?businessId=${user.businessId}`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) return;
        const payload = await response.json();
        setFollowUpQueue(Array.isArray(payload) ? payload : []);
      } catch (queueError) {
        console.error("[Training] Queue fetch error", queueError.message);
      }
    };

    fetchQueue();
  }, [token, user?.businessId]);

  const handleSaveTraining = async () => {
    if (!user?.businessId) return;

    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/${user.businessId}/training`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            services: parseServicesInput(servicesInput),
            description: String(descriptionInput || "").trim(),
            tone: String(toneInput || "professional")
              .trim()
              .toLowerCase(),
            prices: parsePricingInput(pricingInput),
            faqs: parseFaqInput(faqInput),
            restrictions: String(restrictionsInput || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            followUpEnabled,
            followUpDelayHours,
            followUpMessage,
            imageAnalysisEnabled,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to save training data");
      setMessage("AI training data saved successfully.");
    } catch (saveError) {
      console.error("[Training] Save error", saveError.message);
      setError(saveError.message || "Error saving training data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunFollowUpScan = async () => {
    if (!user?.businessId || !token) return;

    setIsRunningScan(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        apiUrl(`/api/business/follow-ups/run?businessId=${user.businessId}`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to run follow-up scan");
      const payload = await response.json();
      setMessage(
        `Follow-up scan complete. Remaining queue: ${payload.remainingQueue || 0}`,
      );
    } catch (scanError) {
      console.error("[Training] Follow-up scan error", scanError.message);
      setError(scanError.message || "Could not run follow-up scan");
    } finally {
      setIsRunningScan(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="section-heading">
        <h2>AI Training Center</h2>
        <p>Teach the AI your business language so replies stay relevant.</p>
      </div>

      <PageGuide
        title="Training checklist"
        steps={[
          "Describe the business clearly so the AI stays on topic.",
          "Pick the tone you want the AI to use.",
          "List services, FAQs, and any restrictions the AI must follow.",
        ]}
      />

      <div className="panel-card space-y-3">
        <h3 className="font-semibold text-slate-900">
          How this controls the AI
        </h3>
        <p className="text-sm text-slate-600">
          Each business has its own AI behavior. The AI will read only the
          configuration you save here for this tenant.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Description</p>
            <p className="text-sm text-slate-600">
              Tells the AI what this business actually does and keeps replies
              inside the right niche.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Tone</p>
            <p className="text-sm text-slate-600">
              Controls whether the AI sounds friendly, professional, or casual.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">
              Services + FAQs
            </p>
            <p className="text-sm text-slate-600">
              Used to answer questions directly before the AI writes a full
              reply.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Restrictions</p>
            <p className="text-sm text-slate-600">
              Prevents the AI from discussing topics you do not want it to
              cover.
            </p>
          </div>
        </div>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}
      {message ? <div className="status-banner success">{message}</div> : null}

      <div className="panel-card">
        <label className="field-label">Business Description</label>
        <textarea
          className="field-input"
          rows="3"
          placeholder="Describe what this business does"
          value={descriptionInput}
          onChange={(e) => setDescriptionInput(e.target.value)}
        />
        <FieldHint>
          This is used to keep responses focused on the business niche.
        </FieldHint>
      </div>

      <div className="panel-card">
        <label className="field-label">AI Tone</label>
        <select
          className="field-input"
          value={toneInput}
          onChange={(e) => setToneInput(e.target.value)}
        >
          <option value="friendly">Friendly</option>
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
        </select>
        <FieldHint>Choose how the AI should sound to customers.</FieldHint>
      </div>

      <div className="panel-card">
        <label className="field-label">Services</label>
        <textarea
          className="field-input"
          rows="3"
          placeholder="e.g., Plumbing, Electrical, General Repairs"
          value={servicesInput}
          onChange={(e) => setServicesInput(e.target.value)}
        />
        <FieldHint>Use commas or new lines between services.</FieldHint>
      </div>

      <div className="panel-card">
        <label className="field-label">Pricing</label>
        <textarea
          className="field-input"
          rows="4"
          placeholder="JSON format, or lines like: Basic service: 5000"
          value={pricingInput}
          onChange={(e) => setPricingInput(e.target.value)}
        />
        <FieldHint>
          You can paste JSON or use line-by-line format with a colon separator.
        </FieldHint>
      </div>

      <div className="panel-card">
        <label className="field-label">FAQs</label>
        <textarea
          className="field-input"
          rows="4"
          placeholder="Q: What are your hours? A: Mon-Fri 9am-6pm"
          value={faqInput}
          onChange={(e) => setFaqInput(e.target.value)}
        />
        <FieldHint>
          Use Q: ... A: ... on separate lines so the AI can answer instantly.
        </FieldHint>
      </div>

      <div className="panel-card">
        <label className="field-label">Restrictions</label>
        <textarea
          className="field-input"
          rows="4"
          placeholder="One restriction per line, e.g. Do not discuss loans"
          value={restrictionsInput}
          onChange={(e) => setRestrictionsInput(e.target.value)}
        />
        <FieldHint>
          Add scope limits, topics to avoid, and compliance rules here.
        </FieldHint>
      </div>

      <div className="panel-card space-y-4">
        <h3 className="font-semibold text-slate-900">AI Features</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={imageAnalysisEnabled}
              onChange={(e) => setImageAnalysisEnabled(e.target.checked)}
            />
            <span className="text-sm text-slate-700">
              Enable image analysis (AI will understand photos customers send)
            </span>
          </div>
          <FieldHint>
            When enabled, the AI will analyze images customers send to
            understand their needs. When disabled, images will be treated as
            media-only messages.
          </FieldHint>
        </div>
      </div>

      <div className="panel-card space-y-4">
        <h3 className="font-semibold text-slate-900">Sales Follow-Up</h3>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={followUpEnabled}
            onChange={(e) => setFollowUpEnabled(e.target.checked)}
          />
          <span className="text-sm text-slate-700">
            Enable automatic follow-up for inactive leads
          </span>
        </div>
        <div>
          <label className="field-label">Delay (hours)</label>
          <input
            type="number"
            min="1"
            max="168"
            className="field-input"
            value={followUpDelayHours}
            onChange={(e) => setFollowUpDelayHours(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label">Follow-up message</label>
          <textarea
            className="field-input"
            rows="3"
            placeholder="Follow-up message"
            value={followUpMessage}
            onChange={(e) => setFollowUpMessage(e.target.value)}
          />
          <FieldHint>Use {"{{name}}"} to personalize each message.</FieldHint>
        </div>
        <button
          type="button"
          onClick={handleRunFollowUpScan}
          disabled={isRunningScan}
          className="secondary-button"
        >
          {isRunningScan ? "Running Scan..." : "Run Follow-Up Scan Now"}
        </button>
      </div>

      <div className="panel-card space-y-3">
        <h3 className="font-semibold text-slate-900">Follow-Up Queue</h3>
        {followUpQueue.length === 0 ? (
          <p className="muted-text">
            No customers are currently due for a follow-up.
          </p>
        ) : (
          <div className="space-y-2">
            {followUpQueue.map((item) => (
              <div
                key={item.conversationId}
                className="border border-slate-200 rounded p-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.customerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.businessName} • Due after {item.followUpDelayHours}h •
                    Last message:{" "}
                    {new Date(item.lastMessageAt).toLocaleString()}
                  </p>
                </div>
                <span className="badge warn">Queued</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSaveTraining}
        disabled={isLoading}
        className="primary-button"
      >
        {isLoading ? "Saving..." : "Save Training Data"}
      </button>
    </section>
  );
};

export default TrainingCenter;
