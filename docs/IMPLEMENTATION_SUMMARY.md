# Whats_CSR: Cybersecurity-First Implementation

## ✅ Complete Project Scaffold

```
Whats_CSR/
├── README.md                          (Project overview + security checklist)
│
├── backend/                           (Node.js + Express + Prisma)
│   ├── .env.example                   (Environment template)
│   ├── package.json                   (Dependencies: helmet, express-rate-limit, joi, jsonwebtoken)
│   │
│   ├── prisma/
│   │   └── schema.prisma              (MySQL models: SuperAdmin, Business, BusinessAdmin, ControlToggles, Customer, Conversation, Message, PlatformMetric)
│   │
│   └── src/
│       ├── server.js                  (Express app + Helmet + Rate-limit + Error handling)
│       │
│       ├── config/
│       │   └── toggles.js             (Toggle inference: payment, price, booking, first message)
│       │
│       ├── controllers/
│       │   └── webhook.js             (Main webhook logic gate: guardrails → toggles → reply)
│       │
│       ├── middleware/
│       │   ├── auth.js                (JWT verification + role RBAC)
│       │   ├── validateWebhook.js     (Meta X-Hub-Signature validation)
│       │   ├── rateLimiter.js         (DDoS/brute-force protection)
│       │   ├── validateRequest.js     (Joi schema validation)
│       │   └── tenantFilter.js        (Multi-tenancy isolation)
│       │
│       ├── services/
│       │   ├── ai_engine.js           (Groq API wrapper)
│       │   ├── guardrails.js          (Prompt injection detection + sanitizer)
│       │   ├── whatsapp.js            (Meta API wrapper)
│       │   └── auth.js                (JWT + password hashing)
│       │
│       └── lib/
│           └── prisma.js              (Prisma client singleton)
│
├── dashboard/                         (Vite + React + Tailwind)
│   ├── .env.local.example             (Frontend API URL configuration)
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── package.json                   (Dependencies: react, vite, tailwind)
│   │
│   └── src/
│       ├── App.jsx                    (Route auth state → Admin/SuperAdmin dashboard)
│       ├── main.jsx                   (Entry point with AuthProvider)
│       ├── index.css                  (Tailwind directives)
│       │
│       ├── context/
│       │   └── AuthContext.jsx        (Global auth state + JWT management)
│       │
│       └── pages/
│           ├── Login.jsx              (Email/password + SuperAdmin toggle)
│           │
│           ├── AdminDashboard.jsx     (Business owner control center)
│           ├── TrainingCenter.jsx     (Upload FAQs, services, pricing)
│           ├── LiveInbox.jsx          (Real-time conversation feed)
│           ├── TrustCenter.jsx        (3-state toggle controls)
│           ├── HandoffAlerts.jsx      (Red alerts for HUMAN_REQUIRED chats)
│           │
│           ├── SuperAdminDashboard.jsx (Platform owner control panel)
│           ├── TenantManagement.jsx   (All businesses table view)
│           ├── GlobalSettings.jsx     (API usage metrics + error logs)
│           └── Switchboard.jsx        (Pause any tenant instantly)
│
└── docs/
    ├── README.md                      (Project overview)
    ├── SETUP_GUIDE.md                 (Step-by-step initialization)
    ├── SECURITY.md                    (9-layer security architecture)
    └── API_ROUTES.md                  (Complete endpoint reference)
```

## 🔐 Security Layers Implemented

1. **Transport**: Helmet.js security headers
2. **Authentication**: JWT with 2-hour expiry
3. **Authorization**: Role-based RBAC (SUPER_ADMIN, BUSINESS_ADMIN)
4. **Input Validation**: Joi schemas on all endpoints
5. **AI Safety**: Prompt injection detection + non-overridable system prompt boundary
6. **Webhook Integrity**: Meta X-Hub-Signature-256 validation
7. **Multi-Tenancy**: businessId filtering on every database query
8. **Rate Limiting**: 1000 webhook/min, 10 login/15min, 100 api/min
9. **Error Handling**: Comprehensive try-catch with descriptive logging

## 📊 Database Models

### Core Entities

- **SuperAdmin**: Platform owner (email, password, lastLoginAt)
- **Business**: Multi-tenant account (name, whatsappPhoneNumberId, apiKey, isPaused, subscriptionStatus)
- **BusinessAdmin**: Email/password auth per business
- **ControlToggles**: 3-state toggles (AI_FULL, AI_ASK, HUMAN_ONLY) for 4 decision points
- **Customer**: WhatsApp users (waId, name, phoneNumber)
- **Conversation**: Chat threads (status, humanReason, rejectedDrafts count)
- **Message**: Individual messages (direction, needsApproval, rejectionReason)
- **PlatformMetric**: Usage tracking (groqRequestsCount, metaWebhooksCount, messagesProcessed)

## ⚡ WhatsApp Logic Gate (< 500ms)

```
POST /webhook (from Meta)
│
├─ ✅ Validate X-Hub-Signature-256
├─ ✅ Return 200 OK immediately
│
└─ Async process (setImmediate):
    1. Guardrails check (block injection + sanitize)
    2. Load Business + ControlToggles
    3. Detect "person/human/boss"? → Handoff + notification
    4. Infer toggle type (payment, price, booking, first message)
    5. Check toggle mode:
       ├─ AI_FULL: Generate + send immediately
       ├─ AI_ASK: Generate + queue for approval + notify owner
       └─ HUMAN_ONLY: Mark HUMAN_REQUIRED + notify owner
    6. Track metrics (requests, response time)
```

## 🎨 Dashboard Features

### Admin Dashboard (Business Owner)

- **Live Inbox**: Real-time conversation list with message counts
- **Trust Center**: Flip 3-state toggles for each decision type
- **AI Training**: Upload FAQs, services, pricing → AI learns automatically
- **Handoff Alerts**: Red banners for pending human chats

### SuperAdmin Dashboard (Platform Owner)

- **Tenant Management**: Table view of all businesses (status, subscription, joined date)
- **Global Settings**: Groq API usage, Meta webhook count, error rate, avg response time
- **Switchboard**: Kill-switch. Pause any tenant's bot instantly.

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, WHATSAPP tokens, GROQ_API_KEY, JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run dev
```

### Frontend Setup

```bash
cd dashboard
cp .env.local.example .env.local
npm install
npm run dev
```

### Expose via Localtunnel

```bash
npm install -g localtunnel
lt --port 5000
# Copy URL → Meta webhook config
```

## 📋 Non-Negotiables Met

| Requirement                    | Status | Location                                                 |
| ------------------------------ | ------ | -------------------------------------------------------- |
| Instant Response (< 500ms)     | ✅     | `server.js` returnsstatus(200) before processing         |
| Zero Silent Crashes            | ✅     | Try-catch on all API calls in controllers + services     |
| Human Tone (Nigerian-friendly) | ✅     | Strict system prompt in `guardrails.js`                  |
| Modular Code                   | ✅     | Separated: services/, controllers/, middleware/, config/ |
| Environment Variables          | ✅     | `.env.example` with all secrets                          |
| Helmet.js Security             | ✅     | `src/server.js` line 8                                   |
| Rate Limiting                  | ✅     | `middleware/rateLimiter.js` with 3 tiers                 |
| Multi-Tenancy                  | ✅     | `businessId` filtering in every query                    |
| Toggle Logic                   | ✅     | `controllers/webhook.js` lines 120-165                   |
| AI Guardrails                  | ✅     | `services/guardrails.js` with injection detection        |

## 📚 Documentation Files

- **SETUP_GUIDE.md**: Phase-by-phase initialization (database, env, localtunnel testing)
- **SECURITY.md**: 9-layer architecture deep-dive with incident response playbook
- **API_ROUTES.md**: Complete endpoint reference with cURL examples
- **README.md**: Project overview + feature summary

## Next Steps

1. **Initialize Database**: `npx prisma migrate dev --name init`
2. **Create SuperAdmin User**: Manual database entry (or create onboarding endpoint)
3. **Register Test Business**: Via superadmin dashboard
4. **Configure Meta Webhook**: Use localtunnel URL
5. **Test E2E**: Send WhatsApp message → see async processing

## Key Files to Review First

1. [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) — Complete data model
2. [backend/src/server.js](../backend/src/server.js) — Security middleware stack
3. [backend/src/controllers/webhook.js](../backend/src/controllers/webhook.js) — Logic gate implementation
4. [dashboard/src/context/AuthContext.jsx](../dashboard/src/context/AuthContext.jsx) — Frontend auth flow
5. [docs/SECURITY.md](./SECURITY.md) — Detailed security architecture
