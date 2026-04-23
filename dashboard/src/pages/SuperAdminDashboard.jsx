import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import TenantManagement from "./TenantManagement";
import GlobalSettings from "./GlobalSettings";
import Switchboard from "./Switchboard";
import AppIcon from "../components/AppIcon";

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
    { id: "tenants", label: "Tenant Management", icon: "users" },
    { id: "settings", label: "Global Settings", icon: "settings" },
    { id: "switchboard", label: "Switchboard", icon: "sliders" },
  ];

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
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="content-card">
          <div className="p-4 md:p-8">
            {activeTab === "tenants" && <TenantManagement />}
            {activeTab === "settings" && <GlobalSettings />}
            {activeTab === "switchboard" && <Switchboard />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
