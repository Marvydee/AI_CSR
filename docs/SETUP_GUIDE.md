# Whats_CSR Setup Guide

## Phase 1: Cybersecurity-First Foundation

### Backend Security Features

1. **Helmet.js**: Adds secure HTTP headers to prevent XSS, clickjacking, and other attacks.
2. **Rate Limiting**: Protects against brute force and DDoS attacks.
3. **Joi Validation**: Ensures all inputs are validated before processing.
4. **JWT Authentication**: 2-hour token expiry for dashboard access.
5. **Meta X-Hub-Signature Validation**: Only Meta's servers can trigger webhooks.
6. **AI Guardrails**: Detects and blocks prompt injection attempts.
7. **Multi-Tenancy Isolation**: Every database query filters by businessId.

### Initial Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials:
# - DATABASE_URL (Hostinger MySQL)
# - WHATSAPP_VERIFY_TOKEN
# - WHATSAPP_TOKEN
# - META_APP_SECRET
# - GROQ_API_KEY
# - JWT_SECRET (generate a random string)
# - PASSWORD_SALT (generate a random string)

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Phase 2: Database Schema

The schema includes:

- **SuperAdmin**: Platform owner with full access.
- **Business**: Multi-tenant separation with API keys.
- **BusinessAdmin**: Individual admins per business.
- **ControlToggles**: 3-state toggles (AI_FULL, AI_ASK, HUMAN_ONLY) for payment, pricing, booking, first messages.
- **Customer**: WhatsApp users.
- **Conversation**: Chat history with handoff tracking.
- **Message**: Individual messages with approval workflow.
- **PlatformMetric**: Real-time usage tracking.

## Phase 3: WhatsApp AI Logic Gate

### Webhook Flow (under 500ms)

```
POST /webhook (from Meta)
├─ Validate X-Hub-Signature-256
├─ Return 200 OK immediately
└─ Process asynchronously:
    ├─ Run AI guardrails (detect injection)
    ├─ Fetch ControlToggles for business
    ├─ If "person/human/boss" → HUMAN_REQUIRED + handoff notification
    ├─ Infer toggle type (payment, price, booking, first message)
    ├─ Check toggle mode:
    │  ├─ AI_FULL: Send reply immediately
    │  ├─ AI_ASK: Draft for approval
    │  └─ HUMAN_ONLY: Force handoff
    └─ Track metrics
```

## Phase 4: Dual-Dashboard Architecture

### Admin Dashboard (Business Owner)

**Tabs:**

1. **Live Inbox**: Real-time conversation feed
2. **Trust Center**: Control toggle states
3. **AI Training**: Upload FAQs, services, pricing
4. **Handoff Alerts**: Pending human chats

**URL**: http://localhost:5173

### SuperAdmin Dashboard (You)

**Tabs:**

1. **Tenant Management**: View all businesses (table, status, subscription)
2. **Global Settings**: Monitor Groq/Meta API usage, error logs
3. **Switchboard**: Pause any tenant instantly

**URL**: http://localhost:5173 (login with superadmin=true)

## Testing with Localtunnel

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Expose to Meta
npm install -g localtunnel
lt --port 5000

# Terminal 3: Start frontend
cd dashboard
npm install
npm run dev
```

Copy the Localtunnel URL (e.g., https://your-subdomain.loca.lt) and:

1. Go to Meta App → Webhooks
2. Set Callback URL: `https://your-subdomain.loca.lt/webhook`
3. Set Verify Token: Match your WHATSAPP_VERIFY_TOKEN
4. Test by sending a message to your WhatsApp number

## Non-Negotiables Met

✅ **Instant Response**: Webhook returns 200ms immediately.  
✅ **Zero Silent Crashes**: Try-catch on all API calls with descriptive logs.  
✅ **Human Tone**: Strict system prompt blocks robotic responses.  
✅ **Modular Code**: Separated services, controllers, middleware.  
✅ **Environment Variables**: All secrets in .env.  
✅ **AI Guardrails**: Prompt injection defense active.  
✅ **Multi-Tenancy**: businessId filtering on every query.  
✅ **Toggle Engine**: Respect business control at every decision point.
