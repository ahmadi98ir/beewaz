import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const sessionStatusEnum = pgEnum('session_status', [
  'active',
  'lead_captured',
  'assigned',
  'closed',
])

export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
])

export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'converted',
  'lost',
])

// ─── Chat Sessions ────────────────────────────────────────────────────────────

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // کاربر ممکن است ناشناس باشد — یکی از دو فیلد زیر پر می‌شود
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  visitorToken: varchar('visitor_token', { length: 100 }),

  status: sessionStatusEnum('status').default('active').notNull(),

  // عامل فروشی که session به او اختصاص داده شده
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Chat Messages ────────────────────────────────────────────────────────────

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => chatSessions.id, { onDelete: 'cascade' })
    .notNull(),

  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),

  // داده‌های ساختاریافته از AI — intent، confidence، اطلاعات شناسایی‌شده
  metadata: jsonb('metadata').$type<{
    intent?: string
    confidence?: number
    extractedPhone?: string
    extractedName?: string
    requestId?: string
    cartActionId?: string
    cartPlan?: Array<{
      sku: string
      quantity: number
    }>
    packageMode?: 'security_system'
    packageNeeds?: {
      areaM2: number | null
      doors: number | null
      windows: number | null
      motionAreas: number | null
      wiringPreference: 'wired' | 'wireless' | 'hybrid' | 'unknown'
      novice: boolean
    }
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Leads (CRM) ──────────────────────────────────────────────────────────────

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, {
    onDelete: 'set null',
  }),

  // اطلاعاتی که چت‌بات از مشتری جمع می‌کند
  fullName: varchar('full_name', { length: 100 }),
  phone: varchar('phone', { length: 15 }).notNull(),  // هدف اصلی
  city: varchar('city', { length: 100 }),
  inquiryType: varchar('inquiry_type', { length: 100 }), // خانگی / تجاری / پارکینگ

  // خلاصه مکالمه توسط AI برای تیم فروش
  aiSummary: text('ai_summary'),

  status: leadStatusEnum('status').default('new').notNull(),

  // عامل فروشی که با این لید تماس گرفته
  assignedTo: uuid('assigned_to').references(() => users.id, {
    onDelete: 'set null',
  }),
  contactedAt: timestamp('contacted_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, { fields: [chatSessions.userId], references: [users.id] }),
  agent: one(users, {
    fields: [chatSessions.assignedTo],
    references: [users.id],
    relationName: 'assignedSessions',
  }),
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}))

export const leadsRelations = relations(leads, ({ one }) => ({
  session: one(chatSessions, {
    fields: [leads.sessionId],
    references: [chatSessions.id],
  }),
  assignedAgent: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
    relationName: 'assignedLeads',
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatSession = typeof chatSessions.$inferSelect
export type NewChatSession = typeof chatSessions.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number]
