-- Add AI preferences column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{
  "auto_categorize": true,
  "categorize_confidence_threshold": 80,
  "review_low_confidence": true,
  "spending_insights": true,
  "savings_suggestions": true,
  "budget_recommendations": true,
  "investment_tips": false,
  "bill_negotiation_tips": true,
  "chat_personality": "friendly",
  "include_spending_context": true,
  "proactive_insights": true,
  "detect_recurring": true,
  "detect_subscriptions": true,
  "detect_unusual_spending": true,
  "merchant_cleanup": true,
  "smart_search": true,
  "allow_transaction_analysis": true,
  "improve_ai_models": false
}'::jsonb;

-- Add comment
COMMENT ON COLUMN user_profiles.ai_preferences IS 'User preferences for AI-powered features including categorization, insights, and privacy settings';
