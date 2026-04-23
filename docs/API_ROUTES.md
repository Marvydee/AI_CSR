# API Routes Reference

## Authentication

### POST /auth/admin/login

Login for Business Admin

**Request**:

```json
{
  "email": "admin@business.com",
  "password": "securePassword123"
}
```

**Response**:

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "cuid123",
    "email": "admin@business.com",
    "businessId": "cuid456",
    "businessName": "Acme Corp"
  }
}
```

**Headers**: None (public endpoint, rate-limited)

---

### POST /auth/superadmin/login

Login for SuperAdmin

**Request**:

```json
{
  "email": "superadmin@whats-csr.com",
  "password": "securePassword123"
}
```

**Response**: Same format as admin login, but `role: "SUPER_ADMIN"`

---

## Business Admin Endpoints

All require: `Authorization: Bearer <accessToken>`

### GET /api/conversations

Fetch all conversations for the logged-in business

**Query Params**:

- `status`: Filter by AI_ACTIVE | HUMAN_REQUIRED | CLOSED (optional)
- `limit`: 10 (default), `offset`: 0 (default)

**Response**:

```json
[
  {
    "id": "conv123",
    "businessId": "biz456",
    "customerId": "cust789",
    "customer": { "id": "cust789", "name": "John", "waId": "234..." },
    "status": "AI_ACTIVE",
    "lastMessageAt": "2025-04-09T10:30:00Z",
    "messages": [...]
  }
]
```

---

### GET /api/conversations/:conversationId

Fetch a single conversation with full message history

**Response**:

```json
{
  "id": "conv123",
  "customer": {...},
  "messages": [
    {
      "id": "msg1",
      "direction": "INBOUND",
      "body": "Hi, what are your prices?",
      "createdAt": "2025-04-09T10:30:00Z"
    },
    {
      "id": "msg2",
      "direction": "DRAFT_TO_APPROVE",
      "body": "Our prices start at ₦5,000...",
      "needsApproval": true,
      "approvalSeenAt": null
    }
  ]
}
```

---

### PUT /api/business/toggles/:toggleKey

Update a single toggle

**Request**:

```json
{
  "value": "AI_ASK"
}
```

**Params**:

- `toggleKey`: togglePaymentDetails | togglePriceQuotes | toggleBookingConfirmation | toggleFirstCustomerMessage

**Response**:

```json
{
  "success": true,
  "toggleKey": "togglePaymentDetails",
  "value": "AI_ASK"
}
```

---

### GET /api/business/toggles

Fetch all toggles for the business

**Response**:

```json
{
  "togglePaymentDetails": "AI_ASK",
  "togglePriceQuotes": "AI_FULL",
  "toggleBookingConfirmation": "HUMAN_ONLY",
  "toggleFirstCustomerMessage": "AI_ASK"
}
```

---

### PUT /api/business/training

Update AI training data (FAQs, services, prices)

**Request**:

```json
{
  "services": ["Plumbing", "Electrical"],
  "prices": { "basic": "₦5,000", "premium": "₦10,000" },
  "faqs": ["Q: Hours? A: Mon-Fri 9am-6pm", "Q: Warranty? A: 6 months"]
}
```

**Response**:

```json
{
  "success": true,
  "message": "Training data updated"
}
```

---

### POST /api/messages/:messageId/approve

Approve a draft message and send to customer

**Request**:

```json
{
  "sendToCustomer": true
}
```

**Response**:

```json
{
  "success": true,
  "metaMessageId": "wamid.123...",
  "sentAt": "2025-04-09T10:31:00Z"
}
```

---

### POST /api/messages/:messageId/reject

Reject a draft message (do not send)

**Request**:

```json
{
  "reason": "Too salesy, needs revision"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Draft rejected"
}
```

---

## SuperAdmin Endpoints

All require: `Authorization: Bearer <superAdminToken>` + role: SUPER_ADMIN

### GET /api/superadmin/tenants

Fetch all registered businesses

**Query Params**:

- `status`: ACTIVE | SUSPENDED | PAUSED | EXPIRED (optional)
- `limit`: 50 (default)

**Response**:

```json
[
  {
    "id": "biz123",
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "subscriptionStatus": "ACTIVE",
    "isPaused": false,
    "createdAt": "2025-01-15T08:00:00Z"
  }
]
```

---

### PUT /api/superadmin/tenants/:businessId/pause

Pause a tenant's bot

**Request**:

```json
{
  "isPaused": true
}
```

**Response**:

```json
{
  "success": true,
  "businessId": "biz123",
  "isPaused": true
}
```

**Effect**: Tenant's webhook will skip processing. Customers receive "service temporarily unavailable" message.

---

### GET /api/superadmin/metrics

Fetch platform-wide metrics

**Response**:

```json
{
  "totalRequests": 12500,
  "errorRate": "0.8%",
  "averageResponseTime": "245ms",
  "groqApiUsage": 8900,
  "totalActiveBusinesses": 42,
  "totalConversations": 3421
}
```

---

### GET /api/superadmin/tenants/:businessId/logs

Fetch webhook logs for a specific tenant (last 1 hour)

**Query Params**:

- `level`: error | warn | info (optional)
- `limit`: 100 (default)

**Response**:

```json
[
  {
    "timestamp": "2025-04-09T10:30:00Z",
    "level": "error",
    "message": "Groq API timeout",
    "tenantId": "biz123",
    "customerId": "cust456"
  }
]
```

---

## Webhook Endpoint

### POST /webhook

Receive WhatsApp messages from Meta

**Headers Required**:

- `X-Hub-Signature-256`: sha256=<hmac>

**Body**:

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "234123456789",
                "id": "wamid.123...",
                "text": { "body": "Hi, what's your price?" }
              }
            ],
            "metadata": {
              "phone_number_id": "111222333"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response**:

```
HTTP 200 OK
```

**Processing** (asynchronous):

1. Validates X-Hub-Signature-256
2. Runs guardrails check
3. Loads business + toggles
4. Generates reply (if applicable)
5. Sends message back to customer (if AI_FULL or AI_ASK approved)

---

## Error Codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 200  | Success                                                     |
| 400  | Validation error (malformed request)                        |
| 401  | Missing or invalid token                                    |
| 403  | Forbidden (wrong role, different tenant, invalid signature) |
| 404  | Resource not found                                          |
| 429  | Rate limit exceeded                                         |
| 500  | Server error (unexpected exception)                         |

---

## Testing with cURL

### Login as Admin

```bash
curl -X POST http://localhost:5000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@biz.com",
    "password": "password123"
  }'
```

### Fetch Conversations

```bash
curl http://localhost:5000/api/conversations \
  -H "Authorization: Bearer <accessToken>"
```

### Approve a Draft Message

```bash
curl -X POST http://localhost:5000/api/messages/msg123/approve \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"sendToCustomer": true}'
```

### Pause a Tenant (SuperAdmin)

```bash
curl -X PUT http://localhost:5000/api/superadmin/tenants/biz123/pause \
  -H "Authorization: Bearer <superAdminToken>" \
  -H "Content-Type: application/json" \
  -d '{"isPaused": true}'
```
