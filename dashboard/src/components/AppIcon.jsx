import React from "react";

const iconMap = {
  inbox: (
    <path
      d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm2 0 6 5 6-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  shield: (
    <path
      d="M12 3 5.5 6v5.5c0 4.2 2.7 7.3 6.5 8.5 3.8-1.2 6.5-4.3 6.5-8.5V6L12 3Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  box: (
    <path
      d="m12 3 8 4.5-8 4.5L4 7.5 12 3Zm8 4.5V16L12 21 4 16V7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  wrench: (
    <path
      d="M20 7.5a4.5 4.5 0 0 1-6.1 4.2l-7.6 7.6a2 2 0 0 1-2.8-2.8l7.6-7.6A4.5 4.5 0 1 1 20 7.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  building: (
    <path
      d="M4 20h16M6 20V6h12v14M9 9h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  cpu: (
    <path
      d="M9 9h6v6H9zM12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  alarm: (
    <path
      d="M12 8v4l2.5 1.5M5 4l-2 2m16-2 2 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  edit: (
    <path
      d="M3 17.2V21h3.8l10-10-3.8-3.8-10 10ZM14.6 6.4l1.8-1.8a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1l-1.8 1.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  user: (
    <path
      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  users: (
    <path
      d="M7.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20a5 5 0 0 1 10 0m2 0a4.5 4.5 0 0 1 7 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <path
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19 12a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-1.8-1l-.3-2.6h-4l-.3 2.6a7.4 7.4 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 1.8 1l.3 2.6h4l.3-2.6a7.4 7.4 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.6.1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sliders: (
    <path
      d="M4 6h10M17 6h3M11 6a2 2 0 1 0 0 .01M4 12h3m7 0h6M7 12a2 2 0 1 0 0 .01M4 18h12m3 0h1m-6 0a2 2 0 1 0 0 .01"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  logout: (
    <path
      d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m4-12h8m0 0-3-3m3 3-3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

const AppIcon = ({ name, className = "" }) => {
  const icon = iconMap[name] || iconMap.settings;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {icon}
    </svg>
  );
};

export default AppIcon;
