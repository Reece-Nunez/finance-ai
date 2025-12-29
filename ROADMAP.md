# FinanceAI Feature Roadmap

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
- [x] **Predictive Cash Flow** - 30-day balance forecast with recurring transaction detection, visual chart, low balance alerts, and daily spending rate analysis

---

## In Progress

*Nothing currently in progress*

---

## Immediate High-Value (Priority 1)

- [ ] **Smart Anomaly Detection**
  - Real-time alerts for unusual transactions (potential fraud)
  - Detects subscription price increases
  - Flags duplicate charges
  - Compares merchant charges to historical averages

- [ ] **Subscription Intelligence**
  - Auto-detects all subscriptions from transaction data
  - Dashboard showing all active subscriptions with annual cost
  - Usage tracking: "You've used Hulu 2 times in 3 months"
  - Cancellation reminders for unused services

- [ ] **Financial Health Score**
  - Dynamic score (0-100) for overall financial wellness
  - Factors: savings rate, debt ratio, emergency fund, spending consistency
  - AI explains what's helping/hurting your score
  - Historical trend tracking

---

## Medium-Term Differentiators (Priority 2)

- [ ] **Natural Language Transaction Search**
  - "How much did I spend on Amazon in December?"
  - "Show all transactions over $100 this year"
  - "What's my average grocery spending?"
  - "Compare my food spending this month vs last month"

- [ ] **Receipt OCR & Attachment**
  - Snap photos of receipts via mobile
  - AI extracts merchant, amount, date, line items
  - Auto-matches to existing transactions
  - Stores for warranty tracking and tax purposes

- [ ] **Tax Preparation Mode**
  - AI categorizes tax-deductible expenses throughout the year
  - Generates year-end tax summary reports
  - Flags commonly missed deductions
  - Export data for tax software (TurboTax, etc.)

- [ ] **Smart Savings Goals**
  - AI analyzes spending and suggests realistic savings goals
  - "Based on your patterns, you could save $340/month"
  - Identifies specific cuts: "Switching coffee shops saves $47/month"
  - Progress tracking with projections

---

## Unique AI-Native Features (Priority 3)

- [ ] **Financial Scenarios ("What-If" Analysis)**
  - "What if I got a 10% raise?"
  - "What if I paid off my car loan early?"
  - "What if I moved to a cheaper apartment?"
  - Interactive simulations with AI-generated insights

- [ ] **Spending Challenges**
  - AI-generated weekly micro-challenges based on spending patterns
  - "This week: Keep dining out under $50"
  - Progress tracking with streaks and achievements
  - Gamification elements (badges, leaderboards for shared accounts)

- [ ] **Bill Negotiation Coach**
  - Identifies bills that could be negotiated (cable, insurance, phone)
  - Provides AI-generated negotiation scripts
  - Tracks negotiation attempts and savings
  - Suggests timing for renegotiation

- [ ] **Merchant Intelligence**
  - Context about merchants (hours, location, category)
  - Finds deals and cashback opportunities
  - Suggests alternatives: "Save 15% at competitor nearby"
  - Price comparison for common purchases

---

## Future Enhancements (Priority 4)

- [ ] **Voice Interface**
  - Voice commands for quick balance checks
  - "Hey, what's my checking balance?"
  - Add transactions via voice
  - Voice-enabled AI chat

- [ ] **Multi-Currency Support**
  - Track accounts in different currencies
  - Automatic conversion with live rates
  - Travel spending tracking
  - Crypto portfolio integration

- [ ] **Family/Shared Finances**
  - Multiple users per household
  - Shared budgets and goals
  - Individual vs shared spending views
  - AI insights for household spending

- [ ] **Smart Alert Learning**
  - AI learns your notification preferences
  - Reduces noise, surfaces important alerts
  - Context-aware timing (not during meetings)
  - Priority scoring for alerts

- [ ] **Investment Portfolio Analysis**
  - Connect brokerage accounts via Plaid
  - AI analysis of portfolio performance
  - Diversification recommendations
  - Tax-loss harvesting suggestions

- [ ] **Debt Payoff Optimizer**
  - Track all debts in one place
  - AI recommends payoff strategy (avalanche vs snowball)
  - Calculates interest savings
  - Payment scheduling and reminders

---

## Technical Improvements

- [ ] **Mobile App (React Native)**
- [ ] **Push Notifications**
- [ ] **Offline Mode**
- [ ] **Data Export (CSV, PDF reports)**
- [ ] **Two-Factor Authentication**
- [ ] **Biometric Login (mobile)**
- [ ] **Widget Support (iOS/Android)**
- [ ] **Apple/Google Wallet Integration**

---

## Notes

### Predictive Cash Flow (Dec 28, 2024)
- **Files added:** `src/lib/cash-flow.ts`, `src/app/api/cash-flow/forecast/route.ts`, `src/components/dashboard/cash-flow-forecast.tsx`
- **Algorithm:** Uses recurring transaction detection to identify income/expenses, projects balance daily for 30 days
- **Features:** Area chart visualization, low/negative balance alerts, confidence scoring based on data quality
- **Daily spending rate:** Calculated from non-recurring transactions over last 30 days with weekend adjustment (1.3x)

---

**Last Updated:** December 28, 2024
