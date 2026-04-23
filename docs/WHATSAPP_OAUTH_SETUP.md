# WhatsApp Embedded OAuth Connection Guide

## Overview

The system now supports seamless, one-click WhatsApp connection directly in onboarding using Meta's OAuth flow. No manual phone number ID entry required for normal use.

## How It Works End-to-End

### User Flow

1. **Owner in onboarding sees a "Connect WhatsApp" button**
   - Status shows "Not connected yet"
   - Button is blue and clickable

2. **Owner clicks "Connect WhatsApp"**
   - Frontend fetches an OAuth authorize URL from backend
   - Meta login page opens in a new window/tab
   - Owner logs in with their Meta account
   - Owner grants permission to app

3. **Owner is redirected back to the app**
   - Callback URL includes a short-lived `code` and `state`
   - Frontend POST-s this code to the backend OAuth callback endpoint
   - Backend exchanges code for access token
   - Backend fetches the WhatsApp Business Account phone numbers
   - Backend saves `phone_number_id` and `display_phone_number` to the business

4. **Onboarding UI updates**
   - Status shows "Connected"
   - Business phone number is pre-filled and read-only
   - Button text changes to "Connected" (disabled)
   - Message displays the connected phone number

### Backend Architecture

#### New Service: `metaOAuth.js`

Provides OAuth flow utilities:

- `buildMetaOAuthAuthorizeUrl({ businessId })` → Returns `{ authorizeUrl, state }`
  - Generates a state token for CSRF protection
  - Builds the Meta authorization URL with proper scopes
- `exchangeOAuthCodeForToken({ code })` → Returns `{ accessToken, userId }`
  - Exchanges short-lived code for long-lived user access token
- `getWhatsAppBusinessAccountAndPhoneNumber({ accessToken })` → Returns phone number details
  - Fetches the user's business accounts from Meta
  - Finds the linked WhatsApp Business Account
  - Returns first phone number ID and display number

#### New Routes in `business.js`

**GET `/api/business/:businessId/whatsapp/oauth/authorize`**

- Protected: JWT + Business Admin
- Generates OAuth state token and saves it to `business.aiTrainingData.oauthState`
- Returns the Meta authorization URL
- State token expires in 1 hour

**POST `/api/business/:businessId/whatsapp/oauth/callback`**

- Protected: JWT + Business Admin
- Validates incoming code and state match stored state
- Exchanges code for access token
- Fetches phone number details from Meta
- Updates `business.whatsappPhoneNumberId` and `business.whatsappBusinessNumber`
- Clears stored OAuth state
- Returns success response with updated onboarding data

### Frontend Implementation

#### Onboarding Wizard Updates

New state:

- `isConnectingWhatsApp` - Tracks OAuth flow in progress

New handler:

- `handleConnectWhatsApp()` - Kicks off OAuth flow
  - Calls authorize endpoint
  - Redirects to Meta login page

New effect:

- Runs on mount/auth change
- Detects OAuth callback in URL search params
- Processes code/state
- Calls OAuth callback endpoint
- Updates UI with connected phone number

Updated UI:

- WhatsApp connection status now shows a card with button
- Button: "Connect WhatsApp" or "Connected" depending on state
- Phone number: Disabled input that auto-fills on connect
- Advanced toggle: Manual phone ID entry hidden by default

## Environment Variables Required

```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
WHATSAPP_OAUTH_REDIRECT_URI=https://yourdomain.com/onboarding
```

The redirect URI must:

- Be registered in Meta App Dashboard
- Point to the onboarding page
- Be accessible from the browser (not localhost in prod)

## Scopes Requested

```
whatsapp_business_management
whatsapp_business_messaging
business_management
```

## Security Details

- **State token**: Random 32-byte hex string, 1-hour expiration
- **Token storage**: Never exposed to browser; server-side only
- **User access token**: Exchanged for phone number, then discarded
- **CSRF protection**: State validation on callback

## Fallback: Advanced Manual Entry

If OAuth flow fails or user prefers manual:

- Click "Show advanced options" toggle
- Enter phone number ID directly
- This bypasses OAuth and uses manual linking

## What Happens on First Webhook

If OAuth wasn't completed but workspace exists:

- First message webhook auto-links based on phone number match
- Normalizes phone numbers to handle format variations
- Updates workspace with real `phone_number_id`
- Future messages route correctly

## Troubleshooting

### "No WhatsApp Business Account linked to this account"

- User logged in with personal Meta account, not business account
- User must log in with account that has Meta Business Suite access

### "No phone numbers found in WhatsApp Business Account"

- WhatsApp Business Account exists but has no registered phone numbers
- User must add phone numbers in Meta Business Suite first

### State validation failed

- Session expired (> 1 hour)
- Multiple concurrent connection attempts
- Browser back button during OAuth flow
- User should click "Connect WhatsApp" again

## Migration from Manual to OAuth

Existing workspaces with manual `pending_*` IDs:

- Still work via auto-linking on first webhook
- Can optionally reconnect via OAuth to override
- OAuth takes precedence over auto-linking on connect

## Next Steps

1. Configure `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_OAUTH_REDIRECT_URI` in `.env`
2. Add redirect URI to Meta App Dashboard
3. Test OAuth flow in dev environment
4. Monitor logs for `[WhatsApp OAuth]` messages during testing
5. Deploy backend and frontend updates
