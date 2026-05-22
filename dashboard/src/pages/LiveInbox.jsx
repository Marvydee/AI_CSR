import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import PageGuide from "../components/ui/PageGuide";
import { apiUrl } from "../services/apiBase.js";

const directionLabel = {
  INBOUND: "Customer",
  OUTBOUND: "You",
  DRAFT_TO_APPROVE: "Draft",
};

const LiveInbox = () => {
  const { token, user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(
          apiUrl(
            `/api/business/conversations?businessId=${user?.businessId || ""}`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const serverMessage =
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to fetch conversations";

          if (response.status === 401 || response.status === 403) {
            throw new Error(
              `Session error (${response.status}): ${serverMessage}. Please log out and log in again.`,
            );
          }

          throw new Error(
            `Request failed (${response.status}): ${serverMessage}`,
          );
        }

        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error("[LiveInbox] Fetch error", error.message);
        setError(error.message || "Failed to fetch conversations");
      } finally {
        setIsLoading(false);
      }
    };

    if (token && user?.businessId) fetchConversations();
  }, [token, user?.businessId]);

  return (
    <div className="space-y-4">
      <PageGuide
        title="What to do here"
        steps={[
          "Click any conversation to view details.",
          "Use status and timestamps to prioritize urgent chats.",
          "Switch to Handoff Alerts for conversations requiring human takeover.",
        ]}
      />

      {error ? <div className="status-banner error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 panel-card">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Live Inbox
          </h2>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading ? (
              <p className="text-slate-600">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="text-slate-600">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    selectedConversation?.id === conv.id
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-900">
                    {conv.customer?.name || conv.customer?.waId || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    Last: {new Date(conv.lastMessageAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel-card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Details</h3>
          {selectedConversation ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Customer:</span>{" "}
                {selectedConversation.customer?.name ||
                  selectedConversation.customer?.waId ||
                  "Unknown"}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={
                    selectedConversation.status === "HUMAN_REQUIRED"
                      ? "text-red-600"
                      : "text-green-600"
                  }
                >
                  {selectedConversation.status}
                </span>
              </p>
              <p>
                <span className="font-medium">Messages:</span>{" "}
                {selectedConversation._count?.messages || 0}
              </p>

              <div className="pt-2">
                <p className="mb-2 font-medium text-slate-900">
                  Recent messages
                </p>
                {selectedConversation.messages?.length ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {[...selectedConversation.messages]
                      .reverse()
                      .map((message) => {
                        const isOutbound = message.direction === "OUTBOUND";
                        return (
                          <div
                            key={message.id}
                            className={`rounded-lg p-2 ${
                              isOutbound
                                ? "bg-blue-50 border border-blue-100"
                                : "bg-white border border-slate-200"
                            }`}
                          >
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                              {directionLabel[message.direction] ||
                                message.direction}
                              {message.needsApproval ? " • Needs approval" : ""}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                              {message.body || "(No content)"}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-slate-600">
                    No messages in this conversation yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-sm">
              Select a conversation to view details
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveInbox;
