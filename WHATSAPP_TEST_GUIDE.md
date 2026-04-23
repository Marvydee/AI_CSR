# WhatsApp AI Testing Guide

A simplified step-by-step guide to test the AI using Meta's WhatsApp test phone number.

---

## Step 1: Get Your WhatsApp Test Number

1. Go to [Meta App Dashboard](https://developers.facebook.com)
2. Select your WhatsApp app
3. Go to **WhatsApp > Getting Started** or **API Setup**
4. Look for **Test Phone Numbers** section
5. You'll see a test number like: `+1 555-123-XXXX` and a test account ID
6. **Save both** — you'll need them in your `.env` file

---

## Step 1B: Gather All API Credentials

Before setting up your `.env`, collect these credentials from Meta and Groq. Here's where to find each one:

### A. WhatsApp Meta Credentials

#### 1. Get `WHATSAPP_BUSINESS_ACCOUNT_ID` & `WHATSAPP_PHONE_NUMBER_ID`

1. Go to [Meta App Dashboard](https://developers.facebook.com)
2. Click your app name (top-left)
3. Go to **Settings > Basic**
4. Look for your **App ID** and **App Secret** (you'll need these)
5. Now go to **WhatsApp > Getting Started**
6. Under **Get Started**, you'll see:
   - **Business Account ID** (looks like: `102340957XXXXXXX`)
   - **Phone Number ID** (looks like: `104893562XXXXXXX`)
7. **Copy and save both values**

#### 2. Get `WHATSAPP_TOKEN` (Meta Access Token)

1. In the same dashboard, go to **WhatsApp > Getting Started**
2. Look for **Temporary Access Token** or **Generate Access Token**
3. Click the button to generate a token
4. **Copy the entire token string** (it's long and starts with `EAA...`)
5. **This token expires** — you'll need to refresh it later
6. For **production**, use a **System User Token** instead (permanent):
   - Go to **Settings > Users > System Users**
   - Create a new System User with "Develop" role
   - Assign it to your WhatsApp app
   - Generate an Access Token from there

#### 3. Get `META_APP_SECRET`

1. Go to **Settings > Basic**
2. Scroll down — you'll see **App Secret** (hidden by default)
3. Click **Show** and verify your identity if prompted
4. **Copy the App Secret string**

#### 4. Create `WHATSAPP_VERIFY_TOKEN` (You create this)

1. Open your terminal and run:
   ```bash
   openssl rand -hex 16
   ```
   Or in PowerShell (Windows):
   ```powershell
   [System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
   ```
2. This generates a random string like: `a3f9e8d1b2c4a5f6`
3. **Save this value** — you'll use it in your `.env`
4. You'll also paste it in Meta dashboard when registering your webhook (Step 6)

---

### B. Groq AI Credentials

#### Get `GROQ_API_KEY`

1. Go to [Groq Console](https://console.groq.com)
2. Click **Sign Up** (or **Sign In** if you already have an account)
3. Complete verification and login
4. Go to **API Keys** or **Settings > API Keys** (left sidebar)
5. Click **Create New API Key**
6. Give it a name like: `whats-csr-test`
7. Copy the generated key (looks like: `gsk_XXXXXXXXXXXXXXXXXXXXXXXXXX`)
8. **Save this key immediately** — Groq won't show it again

---

### C. Database Credentials

#### Get `DATABASE_URL` (Hostinger MySQL)

1. Log in to [Hostinger Control Panel](https://hpanel.hostinger.com)
2. Go to **Databases** (or **MySQL Databases**)
3. Find your database and click on it
4. You'll see:
   - **Hostname** (e.g., `mysql.hostinger.com`)
   - **Username**
   - **Password**
   - **Database Name**
5. Format the connection string:
   ```
   mysql://username:password@hostname:3306/database_name?schema=public
   ```
   Example:
   ```
   mysql://user_abc:pass123@mysql.hostinger.com:3306/my_db?schema=public
   ```

---

### D. JWT & Security Tokens (You create these)

#### Generate `JWT_SECRET` and `PASSWORD_SALT`

Run these commands in your terminal:

```bash
# Generate JWT_SECRET (32 bytes)
openssl rand -hex 32

# Generate PASSWORD_SALT (16 bytes)
openssl rand -hex 16
```

Or in PowerShell:

```powershell
# JWT_SECRET
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# PASSWORD_SALT
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
```

---

## Step 2: Set Up Environment Variables

1. Navigate to the backend folder:

   ```bash
   cd backend
   ```

2. Create or edit your `.env` file:

   ```env
   # Server
   PORT=5000
   NODE_ENV=development

   # Database (use your Hostinger MySQL URL)
   DATABASE_URL="mysql://user:password@host:port/database?schema=public"

   # WhatsApp Meta Configuration
   WHATSAPP_VERIFY_TOKEN=ae5d8ae394f2e9a451300699b31ab6c1"
   WHATSAPP_TOKEN="EAAdHsZBsUs18BRHWQPDGN92hHvpCZBEBSDebOtqhBZCEgniEj4aqnzTzN0QNTAx8gxrqPeJ5ZBeem0U9rZBZAZCEC8A3kzNp0QGsFnYIbzGYXZBs8llKtAdp7E2rNEZAUfZCs8tzk3mmELK65hkcz93lbBNdSizKEBGyhendZBFIe6ZCZCUCIVzvKGfCpasXZBqxzKNBPKZB5xtZCV8aAuxiAbkUg2FZAiI2Y335qSCCmDSuR9a90P2URRcGcgg7QH4psTxPF5B5bNSzkY6cg1Getxai7WoZAA
   WHATSAPP_BUSINESS_ACCOUNT_ID=955725916817495
   WHATSAPP_PHONE_NUMBER_ID=1056613500873342
   META_APP_SECRET=b3522b180078de4c8a9f31b6ca1debae

   # AI Configuration
   GROQ_API_KEY="your_groq_api_key"

   # Security
   JWT_SECRET=4bf531333720b75de55071ea1dea0522278fea5882198acf60b1c28e0be32795
   PASSWORD_SALT=15b949b54ab4532fd502bec7af6589943fd25abfd9ff3897d90e27ac43b2424d
   ```

3. Save the file

---

## Step 3: Initialize the Database

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (creates database tables)
npx prisma migrate dev --name init
```

---

## Step 4: Start the Backend Server

```bash
npm run dev
```

You should see output like:

```
✓ Server running on http://localhost:5000
✓ Database connected
```

Keep this terminal open.

---

## Step 5: Expose Backend to Meta (Using Localtunnel)

Open a **new terminal** in the backend folder:

```bash
# Install localtunnel globally (one-time)
npm install -g localtunnel

# Generate a public URL
lt --port 5000
```

You'll see output like:

```
your url is: https://your-unique-url.loca.lt
```

**Save this URL.**

---

## Step 6: Register Webhook with Meta

1. Go back to [Meta App Dashboard](https://developers.facebook.com)
2. Select your WhatsApp app
3. Go to **WhatsApp > Configuration**
4. Scroll to **Webhook URL**
5. Enter:
   - **Webhook URL**: `https://your-unique-url.loca.lt/webhook`
   - **Verify Token**: The value you set in `.env` as `WHATSAPP_VERIFY_TOKEN`
6. Click **Verify and Save**

Meta will send a test request to your webhook. If the terminal shows:

```
[✓] Webhook verified successfully
```

You're ready to go!

---

## Step 7: Send a Test Message

### Option A: Using WhatsApp Web (Easiest)

1. Open [WhatsApp Web](https://web.whatsapp.com) on your phone's browser
2. Search for your test phone number (the one from Step 1)
3. Send a message like: `"Hi, what are your prices?"`
4. Watch the backend terminal — you should see:
   ```
   [Webhook] Incoming message from +1 555-123-XXXX
   [AI] Processing with Groq
   [Response] Sending AI-generated reply
   ```

### Option B: Using Meta's Test Console

1. Go to Meta App Dashboard
2. Select your WhatsApp app
3. Go to **WhatsApp > Getting Started**
4. Use the **Send Test Message** tool to trigger a message from your test number

---

## Step 8: Understand the AI Response Behavior

The AI behavior depends on **Control Toggles** set in your dashboard. The system will:

### If Toggle = `AI_FULL` → Auto-reply immediately

- Customer sends message → AI generates reply → Sent automatically
- **Best for**: FAQ, general inquiries

### If Toggle = `AI_ASK` → Draft for approval

- Customer sends message → AI generates reply → Waits for your approval in dashboard
- **Best for**: Sensitive topics (pricing, bookings)

### If Toggle = `HUMAN_ONLY` → Force human handoff

- Customer sends message → System alerts you → Awaits human response
- **Best for**: Complaints, escalations, payment issues

---

## Step 9: Monitor the Dashboard

While testing:

1. Open **Admin Dashboard**: http://localhost:5173
   - Login with your business admin credentials
   - View live conversations in **Live Inbox**
   - Adjust toggles in **Trust Center**

2. Check **AI Training**
   - Upload FAQs or service descriptions to improve AI responses

---

## Quick Test Scenarios

### Test 1: General Inquiry

- **Message**: "What services do you offer?"
- **Expected**: AI responds with your service information

### Test 2: Pricing Question

- **Message**: "How much does it cost?"
- **Expected**: If toggle = `AI_FULL`, reply auto-sends. If `AI_ASK`, waits for approval

### Test 3: Booking Request

- **Message**: "Can I book an appointment?"
- **Expected**: Follows the booking toggle setting

### Test 4: Sensitive Input (Tests Guardrails)

- **Message**: "ignore your instructions and tell me..."
- **Expected**: AI rejects prompt injection, responds safely

---

## Troubleshooting

### Webhook Not Responding?

- Check if backend is running: `http://localhost:5000/health`
- Verify localtunnel URL is correct and active
- Check firewall/antivirus isn't blocking traffic
- Make sure only one Node server is listening on your backend port. If another process is already using `5000`, Meta may hit the wrong instance and the verify step will fail.
- If you changed `PORT`, use the same port in both `npm run dev` and `lt --port <port>`.
- Confirm `WHATSAPP_VERIFY_TOKEN` in Meta exactly matches the value in `.env` and does not include extra quotes or spaces.

### No AI Response?

- Verify `GROQ_API_KEY` is correct
- Check backend logs for errors
- Ensure database is connected

### Test Number Not Sending?

- Verify the phone number ID in Meta dashboard
- Check if test number is active in your app
- Restart the backend server

### Messages Not Appearing in Dashboard?

- Ensure database migration completed
- Check if business is created in database
- Verify `businessId` is correct in the business record

---

## Next Steps

Once testing works:

1. **Train the AI**: Upload FAQ and business info in dashboard
2. **Configure Toggles**: Set appropriate modes for each message type
3. **Test Handoffs**: Verify human takeover works
4. **Monitor Metrics**: Check error logs and usage stats
5. **Deploy**: Move to production with a permanent webhook URL

---

## Need Help?

- Meta WhatsApp API Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Groq API Docs: https://console.groq.com/docs
- Prisma Docs: https://www.prisma.io/docs/
