/\*\*

- IMPLEMENTATION_GUIDE.md
-
- Step-by-step guide for completing the SaaS platform implementation
  \*/

# SaaS Implementation Guide

## Phase 1: Database Migration (IMMEDIATE)

### Step 1.1: Run Prisma Migration

```bash
cd Whats_CSR/backend

# Generate migration from schema changes
npx prisma migrate dev --name "add-saas-features"

# This will:
# 1. Create new tables (Order, Invoice, PaymentReminder, etc.)
# 2. Add relations to existing tables (Business, Customer)
# 3. Create indexes for performance
# 4. Generate updated Prisma Client
```

### Step 1.2: Create Database Seeder

File: `Whats_CSR/backend/prisma/seed.js`

```javascript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create pricing plans
  const freePlan = await prisma.pricingPlan.upsert({
    where: { name: "FREE" },
    update: {},
    create: {
      name: "FREE",
      monthlyAICredits: 100,
      supportedProviders: JSON.stringify(["LLAMA"]),
      features: JSON.stringify(["Basic Support", "LLAMA Only"]),
    },
  });

  const proPlan = await prisma.pricingPlan.create({
    data: {
      name: "PRO",
      monthlyAICredits: 1000,
      supportedProviders: JSON.stringify([
        "LLAMA",
        "GEMINI_FLASH",
        "GPT_4O_MINI",
      ]),
      features: JSON.stringify([
        "Priority Support",
        "Multiple AI Providers",
        "Order Management",
        "Analytics",
      ]),
    },
  });

  const businessPlan = await prisma.pricingPlan.create({
    data: {
      name: "BUSINESS",
      monthlyAICredits: 5000,
      supportedProviders: JSON.stringify([
        "LLAMA",
        "GEMINI_FLASH",
        "GPT_4O_MINI",
        "CLAUDE_SONNET",
      ]),
      features: JSON.stringify([
        "24/7 Priority Support",
        "All AI Providers",
        "Order Management",
        "Invoice Generation",
        "Advanced Analytics",
        "Multilingual Support",
      ]),
    },
  });

  console.log("Pricing plans created:", {
    freePlan,
    proPlan,
    businessPlan,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Run seeder:

```bash
npx prisma db seed
```

## Phase 2: API Routes (HIGH PRIORITY)

### Step 2.1: Subscription Management

File: `Whats_CSR/backend/src/routes/subscriptions.js`

```javascript
import express from "express";
import CreditManagerService from "../services/CreditManagerService.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Get current subscription
router.get("/me", authMiddleware(), async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: req.business.id },
      include: { pricingPlan: true },
    });

    const creditStatus = await CreditManagerService.getStatus(req.business.id);

    res.json({ subscription, creditStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upgrade plan
router.post("/upgrade", authMiddleware(), async (req, res) => {
  try {
    const { planName } = req.body;

    const plan = await prisma.pricingPlan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const updated = await prisma.subscription.update({
      where: { businessId: req.business.id },
      data: {
        pricingPlanId: plan.id,
        monthlyAICredits: plan.monthlyAICredits,
        remainingCredits: plan.monthlyAICredits,
      },
      include: { pricingPlan: true },
    });

    // TODO: Trigger payment/billing
    // await processPayment(req.business, plan);

    res.json({
      message: "Plan upgraded successfully",
      subscription: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 2.2: Order Management Routes

File: `Whats_CSR/backend/src/routes/orders.js`

```javascript
import express from "express";
import OrderService from "../services/OrderService.js";
import InvoiceService from "../services/InvoiceService.js";
import { creditCheckMiddleware } from "../middleware/creditCheck.js";

const router = express.Router();

// Create order
router.post(
  "/",
  authMiddleware(),
  creditCheckMiddleware("ORDER_SUMMARY", 50),
  async (req, res) => {
    try {
      const { customerId, items, totalAmount, notes } = req.body;

      const order = await OrderService.createOrder(
        req.business.id,
        customerId,
        {
          items,
          totalAmount,
          notes,
          conversationContext: req.body.context,
        },
      );

      // Generate summary
      const withSummary = await OrderService.generateOrderSummary(order.id, {
        businessName: req.business.name,
      });

      // Create invoice
      const invoice = await InvoiceService.generateFromOrder(order.id);

      res.json({
        order: withSummary,
        invoice,
        message: "Order created and confirmed",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// List orders
router.get("/", authMiddleware(), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const orders = await OrderService.listOrders(req.business.id, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analytics
router.get("/analytics", authMiddleware(), async (req, res) => {
  try {
    const { daysBack = 30 } = req.query;
    const analytics = await OrderService.getAnalytics(req.business.id, {
      daysBack: parseInt(daysBack),
    });

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 2.3: Analytics Routes

File: `Whats_CSR/backend/src/routes/analytics.js`

```javascript
import express from "express";
import AnalyticsService from "../services/AnalyticsService.js";

const router = express.Router();

// Dashboard overview
router.get("/dashboard", authMiddleware(), async (req, res) => {
  try {
    const { daysBack = 30 } = req.query;
    const overview = await AnalyticsService.getDashboardOverview(
      req.business.id,
      { daysBack: parseInt(daysBack) },
    );

    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI provider breakdown
router.get("/providers", authMiddleware(), async (req, res) => {
  try {
    const data = await AnalyticsService.getAIProviderAnalytics(req.business.id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Billing analytics
router.get("/billing", authMiddleware(), async (req, res) => {
  try {
    const data = await AnalyticsService.getBillingAnalytics(req.business.id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Phase 3: Webhook Integration (CRITICAL)

### Step 3.1: Update Webhook Handler

File: `Whats_CSR/backend/src/controllers/webhook.js`

At the top, add credit check:

```javascript
import { creditCheckMiddleware } from "../middleware/creditCheck.js";
import AIRouterService from "../services/AIRouterService.js";
import CustomerPreferencesService from "../services/CustomerPreferencesService.js";

// In handleIncomingMessage:
export async function handleIncomingMessage(message, business) {
  try {
    const { from, text } = message;

    // Get customer
    let customer = await getOrCreateCustomer(business.id, from);

    // Load customer context
    const context = await CustomerPreferencesService.getAIContext(customer.id);

    // Check credits BEFORE generating response
    const creditCheck = await CreditManagerService.hasCredits(
      business.id,
      "TEXT_MESSAGE",
    );

    if (!creditCheck.available) {
      // Send upgrade prompt instead
      return sendWhatsAppMessage({
        to: from,
        text: "Our service is temporarily unavailable. Please upgrade your plan or contact support.",
      });
    }

    // Generate AI response using router
    const aiResult = await AIRouterService.generateResponse({
      businessId: business.id,
      taskType: "TEXT_MESSAGE",
      systemPrompt: buildSystemPrompt(business, customer),
      userMessage: text,
    });

    // Send response
    await sendWhatsAppMessage({
      to: from,
      text: aiResult.text,
    });

    // Store conversation
    await storeConversationMessage(business.id, customer.id, {
      role: "user",
      text,
      provider: aiResult.provider,
      tokensUsed: aiResult.tokensUsed,
    });

    // Store AI response
    await storeConversationMessage(business.id, customer.id, {
      role: "assistant",
      text: aiResult.text,
    });
  } catch (error) {
    logger.error("Webhook error:", error);
    // Fail gracefully - send error message
    await sendWhatsAppMessage({
      to: message.from,
      text: "Sorry, we encountered an error. Please try again in a moment.",
    });
  }
}
```

## Phase 4: Scheduled Tasks (IMPORTANT)

### Step 4.1: Create Cron Service

File: `Whats_CSR/backend/src/services/CronService.js`

```javascript
import cron from "node-cron";
import AnalyticsService from "./AnalyticsService.js";
import ReminderSchedulerService from "./ReminderSchedulerService.js";
import logger from "../utils/logger.js";

export function startScheduledTasks() {
  // Daily metrics at 6 AM
  cron.schedule("0 6 * * *", async () => {
    logger.info("[CRON] Running daily metrics aggregation");
    try {
      // Get all businesses
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const businesses = await prisma.business.findMany();

      for (const business of businesses) {
        await AnalyticsService.recordDailyMetrics(business.id);
      }

      logger.info("[CRON] Daily metrics complete");
    } catch (error) {
      logger.error("[CRON] Daily metrics failed:", error);
    }
  });

  // Process payment reminders every hour
  cron.schedule("0 * * * *", async () => {
    logger.info("[CRON] Processing due payment reminders");
    try {
      const result = await ReminderSchedulerService.processDueReminders();
      logger.info(
        `[CRON] Reminders processed: ${result.sent} sent, ${result.failed} failed`,
      );
    } catch (error) {
      logger.error("[CRON] Reminder processing failed:", error);
    }
  });

  logger.info("[CRON] Scheduled tasks started");
}

// Call in server.js:
// startScheduledTasks();
```

## Phase 5: Frontend Integration

### Step 5.1: Update Dashboard

File: `Whats_CSR/dashboard/src/pages/Dashboard.jsx`

```javascript
import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const response = await api.get("/analytics/dashboard?daysBack=30");
        setMetrics(response.data);
      } catch (error) {
        console.error("Failed to load metrics:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!metrics) return <div>Error loading dashboard</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <h3>Conversations</h3>
          <p className="text-2xl font-bold">{metrics.conversations.total}</p>
          <p className="text-gray-500">
            ~{metrics.conversations.average_per_day}/day
          </p>
        </div>

        <div className="card">
          <h3>Total Revenue</h3>
          <p className="text-2xl font-bold">
            ${metrics.orders.total_value.toFixed(2)}
          </p>
          <p className="text-gray-500">{metrics.orders.total} orders</p>
        </div>

        <div className="card">
          <h3>Credit Usage</h3>
          <p className="text-2xl font-bold">{metrics.credits.total_used}</p>
          <p className="text-gray-500">credits used this month</p>
        </div>
      </div>

      {/* More charts and tables */}
    </div>
  );
}
```

## Testing Checklist

- [ ] Prisma migration completed without errors
- [ ] Pricing plans seeded successfully
- [ ] API routes return data correctly
- [ ] Credit check blocks operations when exhausted
- [ ] AIRouterService selects correct provider for task
- [ ] OrderService extracts order details from message
- [ ] InvoiceService generates sequential numbers
- [ ] ReminderSchedulerService processes reminders correctly
- [ ] AnalyticsService aggregates metrics
- [ ] MultilingualService detects language
- [ ] CustomerPreferencesService stores/retrieves memory

## Next Steps After Implementation

1. **Integrate Real Providers**: Update environment variables with actual API keys
2. **Webhook PDF Generation**: Add invoice PDF generation and upload
3. **Advanced Features**: Customer segmentation ML, sentiment analysis
4. **Mobile App**: Build React Native dashboard for mobile access
5. **Integration Tests**: Comprehensive test suite for all services
6. **Performance Tuning**: Database query optimization, caching layer

---

**Estimated Implementation Time**: 8-12 hours
**Team Size**: 1-2 developers
**Testing Time**: 4-6 hours
