# Business Owner Onboarding Guide (Whats_CSR)

This document describes the current operational onboarding model.
For the SaaS-first user journey, see [SAAS_ONBOARDING_FLOW.md](SAAS_ONBOARDING_FLOW.md).

## 1. Direct answer to your question

Business owners cannot just self-register today and start full automation immediately.

Current platform behavior:

- There is login, but no public business owner signup route yet.
- A Business and BusinessAdmin record must be provisioned first (admin/superadmin/manual SQL process).
- Meta WhatsApp setup is required for real WhatsApp automation (incoming webhook routing and outbound replies).

Without Meta setup, owners can log in and configure parts of the dashboard, but live WhatsApp message handling will not work.

## 2. What exists today in code

Authentication:

- POST /api/auth/admin/login
- POST /api/auth/superadmin/login

Business admin workspace:

- Profile management (business details, prompt, bank details, owner WhatsApp number)
- Account settings (name/email/password)
- Draft review (approve/edit/reject)
- Trust toggles, training data, services, products, handoffs, follow-up controls

Routing dependency:

- Incoming messages are mapped to a business via Business.whatsappPhoneNumberId.
- This must match the Meta phone_number_id of the connected WhatsApp number.

## 3. End-to-end onboarding flow

### Step 0: Internal pre-checks (platform ops)

1. Confirm backend is healthy and can connect to DB.
2. Confirm WhatsApp credentials are valid in backend env:

- WHATSAPP_TOKEN
- META_APP_SECRET
- WHATSAPP_VERIFY_TOKEN

3. Confirm webhook endpoint is publicly reachable in production.

### Step 1: Create business tenant record

Create a Business with at least:

- id
- name
- email (optional but recommended)
- whatsappPhoneNumberId (required and unique)
- subscriptionStatus (typically ACTIVE)

Important:

- whatsappPhoneNumberId must be the actual Meta phone_number_id for that business number.
- This field is unique, so one phone_number_id maps to one tenant.

### Step 2: Create business owner login

Create BusinessAdmin linked to that business:

- businessId
- email
- name
- passwordHash

Password hash format used by backend auth:

- SHA-256(password + PASSWORD_SALT)

If this is not hashed exactly this way, login will fail.

### Step 3: Meta WhatsApp platform setup (required)

In Meta Developer / WhatsApp Cloud setup:

1. Connect or provision the business WhatsApp number.
2. Get the number's phone_number_id.
3. Ensure your backend webhook URL is configured in Meta Webhooks:

- Callback URL: https://<your-api-domain>/webhook
- Verify token must match WHATSAPP_VERIFY_TOKEN in backend env.

4. Subscribe to WhatsApp message events for the app.

### Step 4: Link Meta details to tenant in DB

Verify in DB that Business.whatsappPhoneNumberId equals the number from Meta.

Optional but recommended:

- Set Business.whatsappBusinessNumber to owner's WhatsApp contact used for alert templates.
- Set Business.metaAppId if you track app ownership.

### Step 5: First owner login and baseline setup

Owner logs in via business login screen and configures:

1. Business Profile:

- Business name
- Owner WhatsApp alert number
- Bank details (bank name, account name, account number)
- Optional custom system prompt

2. Account Settings:

- Name/email updates
- Strong password change

3. Trust Center:

- Set AI_FULL / AI_ASK / HUMAN_ONLY for key actions

4. Training Center:

- Services, FAQs, prices, follow-up settings

5. Products/Services:

- Add catalog items used in customer responses

### Step 6: Verification test before go-live

Run these tests in order:

1. Auth test:

- POST /api/auth/admin/login returns accessToken

2. Profile test:

- GET/PUT business profile succeeds

3. Draft flow test:

- Trigger AI_ASK path and verify draft appears in Draft Review
- Approve and send draft from dashboard

4. Handoff test:

- Trigger HUMAN_ONLY and verify handoff appears

5. WhatsApp live test:

- Send message from a real customer number to business number
- Confirm inbound webhook processing and outbound reply path

## 4. SQL bootstrap template (manual onboarding)

Use this as a safe pattern when onboarding manually.

```sql
START TRANSACTION;

-- Required runtime salt from backend .env
SET @salt = 'PASTE_PASSWORD_SALT_HERE';

-- Tenant identity
SET @business_id = 'biz_whatsapp_001';
SET @business_name = 'Example Business';
SET @business_email = 'owner@example.com';
SET @phone_number_id = '1056613500873342';

-- Owner login
SET @admin_email = 'admin@example.com';
SET @admin_name = 'Business Owner';
SET @admin_plain_password = 'password@123';
SET @admin_password_hash = SHA2(CONCAT(@admin_plain_password, @salt), 256);

-- Create business if missing
INSERT INTO Business (
  id, name, email, whatsappPhoneNumberId, subscriptionStatus,
  apiKey, isPaused, createdAt, updatedAt
)
SELECT
  @business_id,
  @business_name,
  @business_email,
  @phone_number_id,
  'ACTIVE',
  REPLACE(UUID(), '-', ''),
  0,
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM Business WHERE id = @business_id OR whatsappPhoneNumberId = @phone_number_id
);

-- Create owner admin if missing
INSERT INTO BusinessAdmin (
  id, businessId, email, passwordHash, name, createdAt, updatedAt
)
SELECT
  REPLACE(UUID(), '-', ''),
  @business_id,
  @admin_email,
  @admin_password_hash,
  @admin_name,
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM BusinessAdmin WHERE businessId = @business_id AND email = @admin_email
);

-- Keep password/name updated when rerun
UPDATE BusinessAdmin
SET
  passwordHash = @admin_password_hash,
  name = @admin_name,
  updatedAt = NOW()
WHERE businessId = @business_id
  AND email = @admin_email;

COMMIT;
```

## 5. Security requirements for onboarding

1. Never store plaintext passwords; always store salted SHA-256 hash used by app.
2. Enforce strong owner password policy at first login.
3. Use HTTPS-only API domain in production.
4. Restrict CORS to allowed dashboard origins.
5. Keep Meta and DB credentials only in env variables.
6. Rotate compromised credentials immediately and restart backend.
7. Verify owner phone/email before enabling production message automation.

## 6. Recommended operational model

For now (current codebase):

- Use assisted onboarding: ops/superadmin provisions tenant + owner account.
- Owner completes profile/training/toggles in dashboard.
- Meta setup is mandatory before declaring the tenant live.

Future enhancement (optional):

- Build self-service business registration with guided Meta connection wizard and automated tenant provisioning.

## 7. Troubleshooting quick map

Problem: Login fails with invalid credentials

- Check BusinessAdmin row exists for business
- Verify password hash uses exact PASSWORD_SALT

Problem: Webhook receives messages but business not found

- Check Business.whatsappPhoneNumberId equals Meta phone_number_id

Problem: Prisma P1000 auth errors

- Reset MySQL password in Hostinger
- Update DATABASE_URL
- Restart backend

Problem: Owner not receiving alerts

- Confirm whatsappBusinessNumber is set in business profile
- Confirm template settings/token validity in backend env
