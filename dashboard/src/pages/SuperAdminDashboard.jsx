import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import TenantManagement from "./TenantManagement";
import GlobalSettings from "./GlobalSettings";
import Switchboard from "./Switchboard";
import RegistrationCodes from "./RegistrationCodes";
import AppIcon from "../components/AppIcon";
import PageGuide from "../components/ui/PageGuide";

const SuperAdminDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("tenants");

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
      id: "tenants",
      label: "Tenant Management",
      icon: "users",
      description: "See tenant status and onboarding progress at a glance.",
    },
    {
      id: "codes",
      label: "Access Codes",
      icon: "shield",
      description: "Generate and track one-time registration codes.",
    },
    {
      id: "settings",
      label: "Global Settings",
      icon: "settings",
      description: "Monitor platform metrics and response performance.",
    },
    {
      id: "switchboard",
      label: "Switchboard",
      icon: "sliders",
      description: "Pause or resume tenant bots for safety operations.",
    },
  ];

  const activeTabConfig =
    tabs.find((tab) => tab.id === activeTab) || tabs[0] || null;

  return (
    <div className="page-shell page-shell-admin">
      <nav className="app-navbar sticky top-0 z-40">
        <div className="app-navbar-inner">
          <div>
            <p className="brand-mark">Whats_CSR</p>
            <h1 className="text-base font-semibold text-slate-900 md:text-xl">
              SuperAdmin Control Panel
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
                <span>
                  {tab.label}
                  <span className="tab-meta">{tab.description}</span>
                </span>
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
                  title="Operator workflow"
                  description="Use this checklist to avoid accidental platform-impacting actions."
                  steps={[
                    "Confirm the tenant or feature you want to operate on.",
                    "Apply the change and review the updated status immediately.",
                    "Return to metrics to confirm platform stability.",
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

            {activeTab === "tenants" && <TenantManagement />}
            {activeTab === "codes" && <RegistrationCodes />}
            {activeTab === "settings" && <GlobalSettings />}
            {activeTab === "switchboard" && <Switchboard />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
