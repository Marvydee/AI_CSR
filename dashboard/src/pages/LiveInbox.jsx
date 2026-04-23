import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const LiveInbox = () => {
  const { token } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/conversations`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!response.ok) throw new Error("Failed to fetch conversations");
        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error("[LiveInbox] Fetch error", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchConversations();
  }, [token]);

  return (
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
                  {conv.customer?.name || conv.customerWaId}
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
              {selectedConversation.customer?.name}
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
              {selectedConversation.messages?.length || 0}
            </p>
          </div>
        ) : (
          <p className="text-slate-600 text-sm">
            Select a conversation to view details
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveInbox;
