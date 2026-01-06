import { z } from 'zod'

// ============================================
// Common Schemas
// ============================================

export const uuidSchema = z.string().uuid('Invalid ID format')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// ============================================
// Transaction Schemas
// ============================================

export const transactionCategorySchema = z.enum([
  'Food & Drink',
  'Shopping',
  'Transportation',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Travel',
  'Education',
  'Personal Care',
  'Home',
  'Groceries',
  'Gas & Fuel',
  'Income',
  'Transfer',
  'Investment',
  'Fees & Charges',
  'Other',
])

export const updateTransactionSchema = z.object({
  id: uuidSchema,
  category: z.string().min(1).max(100).optional(),
  is_income: z.boolean().optional(),
  ignore_type: z.enum(['none', 'budget', 'all']).optional(),
  notes: z.string().max(500).optional(),
  display_name: z.string().min(1).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
})

export const batchCategorizeSchema = z.object({
  transactions: z.array(z.object({
    id: uuidSchema,
    category: z.string().min(1).max(100),
  })).min(1).max(50),
})

export const transactionFilterSchema = z.object({
  category: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  search: z.string().max(200).optional(),
  accountId: uuidSchema.optional(),
}).merge(paginationSchema)

// ============================================
// Budget Schemas
// ============================================

export const createBudgetSchema = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive().max(1000000),
  period: z.enum(['monthly', 'weekly', 'yearly']).default('monthly'),
})

export const updateBudgetSchema = z.object({
  id: uuidSchema,
  amount: z.number().positive().max(1000000).optional(),
  period: z.enum(['monthly', 'weekly', 'yearly']).optional(),
})

// ============================================
// Account Schemas
// ============================================

export const linkAccountSchema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().min(1).optional(),
  institutionName: z.string().min(1).optional(),
})

// ============================================
// Chat/AI Schemas
// ============================================

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
})

export const sendChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  session_id: uuidSchema.optional(),
})

// ============================================
// Transaction Rule Schemas
// ============================================

export const createTransactionRuleSchema = z.object({
  merchant_pattern: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  match_type: z.enum(['exact', 'contains', 'starts_with', 'regex']).default('contains'),
})

// ============================================
// Webhook Schemas
// ============================================

export const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
})

export const plaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string().optional(),
  error: z.object({
    error_code: z.string(),
    error_message: z.string(),
  }).optional(),
})

// ============================================
// User Settings Schemas
// ============================================

export const updateUserSettingsSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  email_reports: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
  anomaly_alerts: z.boolean().optional(),
  bill_reminders: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
})

// ============================================
// Helper Functions
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.core.$ZodIssue[] }

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || 'Validation failed',
    details: result.error.issues,
  }
}

// Sanitize string input to prevent XSS
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Validate and sanitize search input
export function sanitizeSearchQuery(query: string): string {
  return sanitizeString(query.trim().slice(0, 200))
}
