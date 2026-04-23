# Whats_CSR

**Premium AI Employee for Nigerian SMEs** — Multi-tenant automation platform with security-first architecture, human handoff, and business control toggles.

## 🚀 Stack

- **Backend**: Node.js + Express + Prisma (MySQL)
- **Security**: Helmet.js, Rate-limiting, JWT, Joi validation, AI Guardrails
- **AI Engine**: Groq (`llama-3.3-70b-versatile`)
- **Dashboards**: Vite + React + Tailwind (Business Admin + SuperAdmin)

## 🔒 Phase 1: Cybersecurity-First Foundation

### Features

- **Multi-Tenancy Isolation**: Every database query filters by `businessId`. Zero data leakage.
- **AI Guardrails**: Detects prompt injection attempts (e.g., "ignore previous instructions").
- **Meta X-Hub-Signature Validation**: Only Facebook can trigger webhooks.
- **JWT Authentication**: 2-hour token expiry. Separate login for admins and superadmins.
- **Rate Limiting**: Protects against brute force and DDoS.
- **Helmet.js**: Secure HTTP headers (XSS, clickjacking, MIME-sniffing protection).
- **Joi Validation**: All API inputs validated before processing.

## 📊 Phase 2: Database Schema

### Key Models

- **SuperAdmin**: Platform owner. View all businesses, global metrics.
- **Business**: Multi-tenant profile. API keys, subscription status.
- **BusinessAdmin**: Email/password auth per business.
- **ControlToggles**: 3-state toggles (AI_FULL, AI_ASK, HUMAN_ONLY):
  - `togglePaymentDetails`, `togglePriceQuotes`, `toggleBookingConfirmation`, `toggleFirstCustomerMessage`
- **Customer**: WhatsApp users.
- **Conversation**: Chat threads with status (AI_ACTIVE, HUMAN_REQUIRED, CLOSED).
- **Message**: Individual messages with approval workflow.
- **PlatformMetric**: Real-time usage tracking.

## ⚡ Phase 3: WhatsApp AI Logic Gate

### Asynchronous Webhook Architecture (< 500ms ACK)

```
POST /webhook → Validate signature → Return 200 immediately
                                    ↓
                        Process asynchronously:
                        - Guardrails (inject block)
                        - Load business + toggles
                        - Detect "person/human/boss"
                        - Infer toggle type
                        - AI_FULL → send | AI_ASK → queue | HUMAN_ONLY → handoff
```

## 🎨 Phase 4: Dual-Dashboard Architecture

### Admin Dashboard (Business Owner)

- **Live Inbox**: Real-time conversation feed
- **Trust Center**: Control 3-state toggles
- **AI Training**: Upload FAQs, services, pricing
- **Handoff Alerts**: Pending human chats

### SuperAdmin Dashboard (Platform Owner)

- **Tenant Management**: All businesses (status, subscription, usage)
- **Global Settings**: Groq/Meta API metrics, error logs
- **Switchboard**: Pause any tenant instantly

See [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) for complete setup instructions.

## 🔐 Security Checklist

- ✅ Helmet.js, Rate-limiting, JWT, Joi validation
- ✅ Meta X-Hub-Signature validation
- ✅ AI prompt injection defense
- ✅ Multi-tenancy isolation
- ✅ Try-catch on all API calls
- ✅ Environment-based secrets only
