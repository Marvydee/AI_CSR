import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

const DraftReview = () => {
  const { token, user } = useContext(AuthContext);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [editedBody, setEditedBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) || null,
    [drafts, selectedDraftId],
  );

  const fetchDrafts = async () => {
    if (!token || !user?.businessId) return;

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/drafts?businessId=${user.businessId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch draft approvals");
      }

      const data = await response.json();
      const nextDrafts = Array.isArray(data) ? data : [];
      setDrafts(nextDrafts);

      if (!selectedDraftId && nextDrafts.length > 0) {
        setSelectedDraftId(nextDrafts[0].id);
        setEditedBody(nextDrafts[0].body || "");
      }

      if (selectedDraftId) {
        const found = nextDrafts.find((item) => item.id === selectedDraftId);
        if (!found) {
          setSelectedDraftId(nextDrafts[0]?.id || null);
          setEditedBody(nextDrafts[0]?.body || "");
        }
      }
    } catch (fetchError) {
      console.error("[DraftReview] Fetch error", fetchError.message);
      setError(fetchError.message || "Could not load drafts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDrafts();
  }, [token, user?.businessId]);

  useEffect(() => {
    if (selectedDraft) {
      setEditedBody(selectedDraft.body || "");
    }
  }, [selectedDraft?.id]);

  const handleSelectDraft = (draft) => {
    setSelectedDraftId(draft.id);
    setEditedBody(draft.body || "");
  };

  const handleApprove = async () => {
    if (!selectedDraft || !token || !user?.businessId) return;

    const trimmedBody = String(editedBody || "").trim();
    if (!trimmedBody) {
      setError("Draft message cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/drafts/${selectedDraft.id}/approve?businessId=${user.businessId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: trimmedBody }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to approve draft");
      }

      await fetchDrafts();
    } catch (approveError) {
      console.error("[DraftReview] Approve error", approveError.message);
      setError(approveError.message || "Could not approve draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDraft || !token || !user?.businessId) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/business/drafts/${selectedDraft.id}/reject?businessId=${user.businessId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: "Owner rejected draft" }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to reject draft");
      }

      await fetchDrafts();
    } catch (rejectError) {
      console.error("[DraftReview] Reject error", rejectError.message);
      setError(rejectError.message || "Could not reject draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="section-heading">
        <h2>Draft Review</h2>
        <p>Review AI-generated drafts before they are sent to customers.</p>
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="review-grid">
        <div className="panel-card">
          <div className="panel-title">Pending Drafts</div>
          {isLoading ? (
            <p className="muted-text">Loading drafts...</p>
          ) : drafts.length === 0 ? (
            <p className="muted-text">No drafts waiting for review.</p>
          ) : (
            <div className="draft-list">
              {drafts.map((draft) => {
                const customerName =
                  draft.conversation?.customer?.name ||
                  draft.conversation?.customer?.waId ||
                  "Customer";

                return (
                  <button
                    type="button"
                    key={draft.id}
                    onClick={() => handleSelectDraft(draft)}
                    className={`draft-item ${selectedDraftId === draft.id ? "selected" : ""}`}
                  >
                    <div className="draft-item-title">{customerName}</div>
                    <div className="draft-item-subtitle">
                      {new Date(draft.createdAt).toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-title">Edit Draft</div>
          {!selectedDraft ? (
            <p className="muted-text">Select a draft to review and edit.</p>
          ) : (
            <>
              <textarea
                className="field-input min-h-[220px]"
                value={editedBody}
                onChange={(event) => setEditedBody(event.target.value)}
                maxLength={2000}
              />
              <div className="panel-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isSubmitting}
                  onClick={handleReject}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSubmitting}
                  onClick={handleApprove}
                >
                  {isSubmitting ? "Saving..." : "Approve and Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default DraftReview;
