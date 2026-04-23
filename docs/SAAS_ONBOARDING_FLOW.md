# Whats_CSR SaaS Onboarding Flow

## Goal

Make onboarding feel seamless for Nigerian business owners.

The owner should not experience this as a technical Meta setup or a manual tenant creation process. They should experience it as:

1. Sign up
2. Create workspace
3. Connect WhatsApp
4. Add business details
5. Go live

## Core product principle

This is a SaaS, so onboarding must be self-serve and guided.

The platform owner should handle the Meta app and backend infrastructure. The business owner should not need to create a Meta app or understand the technical webhook setup.

## Important clarification about Meta

### They usually do NOT need to create a Meta Portfolio or Meta App

In a proper SaaS setup:

- Your company owns and configures the Meta app.
- The business owner connects their own WhatsApp Business account/number through the onboarding flow.
- The connection is done inside your product using a guided Meta flow.

### What may still be required from the business owner

Depending on Meta's policies and the account state:

- They may need to log in with Facebook during connection.
- They may need to confirm WhatsApp Business ownership.
- They may need to complete verification steps only if Meta requires it for the number, messaging limits, or trust requirements.

### What they should NOT have to do

- Build a Meta app
- Manually edit webhook settings
- Understand phone_number_id routing
- Handle database setup
- Create tenant records manually

## Recommended SaaS onboarding journey

### Step 1: Sign up

Owner enters:

- Full name
- Email
- Password
- Business name

System creates:

- Business workspace
- BusinessAdmin account
- Authentication token/session

### Step 2: Create workspace

After signup, create a workspace shell immediately.

Show a progress tracker like:

- Account created
- Business profile
- WhatsApp connection
- AI setup
- Payments and bank details
- Ready to use

### Step 3: Connect WhatsApp

This should be a guided connection step inside the app.

The screen should explain:

- This is how the AI receives and replies to customer messages.
- The owner must connect the number they want to use.
- The platform will handle the technical setup.

The connection flow should collect:

- WhatsApp Business phone number
- Optional display/business info
- Facebook login or Meta connection if required by Meta flow

The system should then store:

- business.whatsappPhoneNumberId
- business.whatsappBusinessNumber
- any optional Meta identifiers

### Step 4: Business profile setup

Owner fills in:

- Business name
- Business email
- WhatsApp alert number
- Bank account details
- Business description
- Custom AI prompt if needed

### Step 5: Sales AI setup

Owner configures:

- Services
- Products
- Pricing
- FAQs
- Business hours
- Escalation rules
- Follow-up preferences

### Step 6: Trust settings

Owner chooses how the AI should behave:

- AI_FULL
- AI_ASK
- HUMAN_ONLY

Recommended default for new Nigerian SMBs:

- Price quotes: AI_ASK
- Payment details: AI_ASK or HUMAN_ONLY
- Booking confirmation: AI_ASK
- First message: AI_FULL or AI_ASK depending on business type

### Step 7: Test before go-live

Run a guided test checklist:

- Login works
- Business profile saved
- Bank details saved
- WhatsApp connection successful
- Draft approval works
- Handoff alert works
- Customer message round-trip works

### Step 8: Go live

Once the checklist passes:

- Enable automation
- Allow inbound webhook processing
- Allow AI replies based on toggles
- Allow owner approval workflows

## Best SaaS onboarding model for your market

For Nigerian small business owners, the best model is:

### 1. Do not force Meta complexity on day one

Give them a simple business app experience, not a developer experience.

### 2. Keep the flow short

Ask for the minimum needed to get them live.

### 3. Offer assisted onboarding

For owners who get stuck, provide a done-with-you support flow.

### 4. Delay verification until necessary

If Meta verification is needed later, position it as an upgrade for scale and reliability, not a blocker to try the product.

### 5. Keep core features visible early

Let them see the dashboard, training, draft review, and business profile as soon as the workspace is created.

## What happens in the background

Your SaaS should handle these automatically:

- Tenant creation
- Login account creation
- Session/auth setup
- Business ID linkage
- Meta webhook routing
- Message processing
- Draft queue generation
- Handoff notifications
- Bank/account data storage

The owner should only see the business workflow, not the infrastructure.

## What the owner should see in the app

A simple onboarding checklist:

1. Create account
2. Connect WhatsApp
3. Add business details
4. Add bank details
5. Add products/services
6. Set AI behavior
7. Test with a customer
8. Go live

## Recommended copy for the onboarding UI

### Welcome screen

"Set up your AI sales assistant in a few minutes. We’ll guide you step by step."

### WhatsApp connection screen

"Connect the WhatsApp number you want to use for customer conversations. We’ll handle the technical setup."

### Verification screen

"Verification is optional for testing, but recommended for higher reliability and scale."

### Go-live screen

"You are ready. Your assistant can now reply, draft, and hand off conversations."

## Security requirements

1. Do not expose superadmin login inside the business flow.
2. Require authenticated workspace access before any sensitive setup.
3. Validate ownership before changing WhatsApp routing.
4. Use role-based access control for admin vs superadmin.
5. Keep Meta tokens and webhook secrets server-side only.
6. Log all onboarding changes for auditability.

## Summary

For SaaS, the correct approach is:

- Self-serve onboarding in-app
- Guided WhatsApp connection
- Platform-owned Meta app
- Optional later verification
- No manual tenant provisioning for the customer

That is the best balance between ease of use and WhatsApp platform requirements.
