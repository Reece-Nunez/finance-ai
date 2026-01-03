# Sterling Feature Roadmap

A rolling feature list for the AI-powered finance app. Check off features as they're completed.

---

## Completed Features

- [x] **Supabase Authentication** - Email/password auth with secure session management
- [x] **Plaid Integration** - Bank account connection and transaction syncing
- [x] **AI Chat** - Anthropic-powered financial assistant
- [x] **Transaction Categorization** - AI auto-categorization with confidence thresholds
- [x] **Budget Management** - Create and track budgets by category
- [x] **Session Security** - 5-min idle timeout, auto-logout, cross-tab sync, secure cookies
- [x] **Toast Notifications** - Sonner-powered stylized alerts
- [x] **Predictive Cash Flow** - 30-day balance forecast with recurring transaction detection, visual chart, low balance alerts, daily spending rate analysis, **and self-learning AI that improves accuracy over time**
- [x] **Smart Anomaly Detection** - Real-time unusual transaction alerts, subscription price increase detection, duplicate charge flagging, merchant average comparison
- [x] **Financial Health Score** - Dynamic 0-100 score with gamified improvement tips, clickable breakdown showing what's helping/hurting score
- [x] **Subscription Intelligence (Recurring Transactions)** - Auto-detects subscriptions and recurring income, calendar view, yearly cost calculation, patterns breakdown modal, "Recently Charged" tracking
- [x] **Merchant Logos** - Google Favicon API integration showing merchant icons (McDonald's, Netflix, etc.) throughout the app with category-based fallback icons
- [x] **Natural Language Transaction Search** - AI-powered search using Claude tool use to parse queries like "How much did I spend on Amazon?", with summary, comparison, and transaction list results
- [x] **Stripe Subscription & Paywall** - Freemium model with Pro tier ($9.99/mo or $79.99/yr), 14-day trial, Stripe Checkout, Customer Portal, webhook handling, feature gating

---

## In Progress

*Nothing currently in progress*

---

## Immediate Priority (Monetization)

- [ ] **Mobile App (React Native/Expo)**
  - Cross-platform iOS & Android
  - Share business logic with web app
  - In-app purchases via Stripe
  - Push notifications

---

## Future Features

- [ ] **Smart Savings Goals**
  - AI analyzes spending and suggests realistic savings goals
  - "Based on your patterns, you could save $340/month"
  - Identifies specific cuts: "Switching coffee shops saves $47/month"
  - Progress tracking with projections

- [ ] **Financial Scenarios ("What-If" Analysis)**
  - "What if I got a 10% raise?"
  - "What if I paid off my car loan early?"
  - Interactive simulations with AI-generated insights

- [ ] **Spending Challenges**
  - AI-generated weekly micro-challenges based on spending patterns
  - Progress tracking with streaks and achievements
  - Gamification elements (badges, leaderboards)

- [ ] **Bill Negotiation Coach**
  - Identifies bills that could be negotiated
  - Provides AI-generated negotiation scripts
  - Tracks negotiation attempts and savings

- [ ] **Merchant Intelligence**
  - Finds deals and cashback opportunities
  - Suggests alternatives: "Save 15% at competitor nearby"

- [ ] **Smart Alert Learning**
  - AI learns your notification preferences
  - Reduces noise, surfaces important alerts
  - Priority scoring for alerts

- [ ] **Debt Payoff Optimizer**
  - Track all debts in one place
  - AI recommends payoff strategy (avalanche vs snowball)
  - Calculates interest savings
  - Payment scheduling and reminders

---

## Technical Improvements

- [ ] **Push Notifications**
- [ ] **Data Export (CSV, PDF reports)**
- [ ] **Two-Factor Authentication**

---

## Notes

### Predictive Cash Flow (Dec 28, 2024)
- **Files added:** `src/lib/cash-flow.ts`, `src/app/api/cash-flow/forecast/route.ts`, `src/components/dashboard/cash-flow-forecast.tsx`
- **Algorithm:** Uses recurring transaction detection to identify income/expenses, projects balance daily for 30 days
- **Features:** Area chart visualization, low/negative balance alerts, confidence scoring based on data quality
- **Daily spending rate:** Calculated from non-recurring transactions over last 30 days with weekend adjustment (1.3x)

### Cash Flow Learning System (Dec 28, 2024)
- **Database migration:** `supabase/migrations/011_cash_flow_learning.sql`
- **Core files:** `src/lib/spending-patterns.ts`, `src/app/api/cash-flow/learn/route.ts`
- **Learning capabilities:**
  - **Pattern analysis:** Day-of-week, week-of-month, monthly, category, and seasonal spending patterns
  - **Income tracking:** Identifies income sources with timing and frequency patterns
  - **Prediction snapshots:** Stores daily predictions to compare against actual balances
  - **Accuracy metrics:** Calculates MAE, MPE, RMSE, and direction accuracy
  - **AI root cause analysis:** Uses Claude to analyze WHY predictions were wrong
  - **Self-correction:** Adjusts predictions based on historical accuracy
- **UI features:** "Train AI" button, learning status display, accuracy metrics, pattern counts

### Natural Language Transaction Search (Jan 3, 2026)
- **Files added:** `src/types/search.ts`, `src/lib/search-parser.ts`, `src/app/api/ai/search/route.ts`, `src/components/dashboard/nl-transaction-search.tsx`
- **Architecture:** Uses Claude tool use to parse natural language queries into structured filters
- **Result types:** Transactions (list), Summary (totals/averages with category breakdown), Comparison (period vs period)
- **Features:**
  - AI-powered query parsing with structured filter extraction
  - Date range, amount, merchant, category, and transaction type filters
  - Aggregation support (sum, average, count)
  - Period comparison with percentage change calculation
  - Integrated on transactions page with example query suggestions

---

**Last Updated:** January 3, 2026
