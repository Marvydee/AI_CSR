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
    { id: "inbox", label: "Live Inbox", icon: "inbox" },
    { id: "drafts", label: "Draft Review", icon: "edit" },
    { id: "handoffs", label: "Handoff Alerts", icon: "alarm" },
    { id: "toggles", label: "Trust Center", icon: "shield" },
    { id: "products", label: "Products", icon: "box" },
    { id: "services", label: "Services", icon: "wrench" },
    { id: "profile", label: "Business Profile", icon: "building" },
    { id: "account", label: "Account Settings", icon: "user" },
    { id: "training", label: "AI Training", icon: "cpu" },
  ];

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
