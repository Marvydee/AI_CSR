import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import TrainingCenter from "./TrainingCenter";
import LiveInbox from "./LiveInbox";
import TrustCenter from "./TrustCenter";
import HandoffAlerts from "./HandoffAlerts";
import ProductCatalog from "./ProductCatalog";
import BusinessProfile from "./BusinessProfile";
import ServicesCatalog from "./ServicesCatalog";
import DraftReview from "./DraftReview";
import AccountSettings from "./AccountSettings";
import AppIcon from "../components/AppIcon";
import PageGuide from "../components/ui/PageGuide";

const AdminDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("inbox");

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="panel-card text-center">
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "inbox",
      label: "Live Inbox",
      icon: "inbox",
      description: "Track customer conversations in real time.",
    },
    {
      id: "drafts",
      label: "Draft Review",
      icon: "edit",
      description: "Approve or edit AI responses before sending.",
    },
    {
      id: "handoffs",
      label: "Handoff Alerts",
      icon: "alarm",
      description: "Handle chats that need human attention now.",
    },
    {
      id: "toggles",
      label: "Trust Center",
      icon: "shield",
      description: "Control how much autonomy AI has per task.",
    },
    {
      id: "products",
      label: "Products",
      icon: "box",
      description: "Add products so AI can quote accurate details.",
    },
    {
      id: "services",
      label: "Services",
      icon: "wrench",
      description: "List services and baseline pricing.",
    },
    {
      id: "profile",
      label: "Business Profile",
      icon: "building",
      description: "Keep company and payout data up to date.",
    },
    {
      id: "account",
      label: "Account Settings",
      icon: "user",
      description: "Manage your login identity and password.",
    },
    {
      id: "training",
      label: "AI Training",
      icon: "cpu",
      description: "Teach AI about your business and follow-up style.",
    },
  ];

  const activeTabConfig =
    tabs.find((tab) => tab.id === activeTab) || tabs[0] || null;

  return (
    <div className="page-shell">
      <nav className="app-navbar sticky top-0 z-40">
        <div className="app-navbar-inner">
          <div>
            <p className="brand-mark">Whats_CSR</p>
            <h1 className="text-base font-semibold text-slate-900 md:text-xl">
              {user.businessName || "Business Workspace"}
            </h1>
          </div>
          <button onClick={logout} className="ghost-button">
            <AppIcon name="logout" className="h-4 w-4" />
            Logout
          </button>
        </div>
      </nav>

      <div className="app-layout">
        <aside className="sidebar-card">
          <div className="sidebar-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-item ${
                  activeTab === tab.id ? "active" : ""
                }`}
              >
                <AppIcon name={tab.icon} className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="content-card">
          <div className="p-4 md:p-8">
            {activeTabConfig ? (
              <div className="section-intro space-y-3">
                <div className="section-heading">
                  <h2>{activeTabConfig.label}</h2>
                  <p>{activeTabConfig.description}</p>
                </div>

                <PageGuide
                  title="How to use this section"
                  description="Use these quick steps to complete tasks faster and avoid mistakes."
                  steps={[
                    "Open the tab that matches what you want to do.",
                    "Fill only the required fields first, then add optional details.",
                    "Save changes and check banners for success or error feedback.",
                  ]}
                />

                <label className="field-label mobile-tab-select">
                  Quick navigation on mobile
                </label>
                <select
                  className="field-input"
                  value={activeTab}
                  onChange={(event) => setActiveTab(event.target.value)}
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {activeTab === "inbox" && <LiveInbox />}
            {activeTab === "drafts" && <DraftReview />}
            {activeTab === "toggles" && <TrustCenter />}
            {activeTab === "products" && <ProductCatalog />}
            {activeTab === "services" && <ServicesCatalog />}
            {activeTab === "profile" && <BusinessProfile />}
            {activeTab === "account" && <AccountSettings />}
            {activeTab === "training" && <TrainingCenter />}
            {activeTab === "handoffs" && <HandoffAlerts />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
