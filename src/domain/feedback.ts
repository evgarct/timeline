import { z } from "zod";

/** Feedback agents leave about the tools they use (MCP, WebMCP, REST): what broke, what is awkward, what works well. */
export const feedbackCategories = ["bug", "friction", "missing_tool", "works_well", "suggestion", "other"] as const;
export const feedbackSeverities = ["low", "medium", "high"] as const;
export const feedbackStatuses = ["new", "triaged", "done", "wontfix"] as const;
export const feedbackSources = ["mcp", "webmcp", "rest"] as const;

export const feedbackCategorySchema = z.enum(feedbackCategories);
export const feedbackSeveritySchema = z.enum(feedbackSeverities);
export const feedbackStatusSchema = z.enum(feedbackStatuses);
export const feedbackSourceSchema = z.enum(feedbackSources);

export const feedbackToolCallSchema = z.object({
  tool: z.string().trim().min(1).max(128),
  outcome: z.enum(["ok", "error", "confusing"]),
  note: z.string().trim().max(300).optional()
});

/** What an agent sends. `source` and `page` are filled in by the transport, never by the agent. */
export const feedbackInputSchema = z.object({
  category: feedbackCategorySchema,
  severity: feedbackSeveritySchema.optional(),
  tool: z.string().trim().min(1).max(128).optional(),
  summary: z.string().trim().min(1).max(200),
  details: z.string().trim().max(4000).optional(),
  expected: z.string().trim().max(2000).optional(),
  suggestion: z.string().trim().max(2000).optional(),
  toolCalls: z.array(feedbackToolCallSchema).max(20).optional(),
  client: z.string().trim().max(120).optional()
});

export const feedbackCreateSchema = feedbackInputSchema.extend({
  source: feedbackSourceSchema.default("rest"),
  page: z.string().trim().max(300).optional()
});

export const feedbackUpdateSchema = z.object({
  status: feedbackStatusSchema.optional(),
  resolution: z.string().trim().max(1000).optional()
}).refine((value) => value.status !== undefined || value.resolution !== undefined, { message: "nothing_to_update" });

export const feedbackSchema = feedbackCreateSchema.extend({
  id: z.string().uuid(),
  status: feedbackStatusSchema,
  resolution: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type FeedbackInput = z.input<typeof feedbackCreateSchema>;
export type FeedbackUpdate = z.infer<typeof feedbackUpdateSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type FeedbackFilter = {
  status?: (typeof feedbackStatuses)[number];
  category?: (typeof feedbackCategories)[number];
  tool?: string;
  limit?: number;
};

/** About this many entries per user per hour: an agent stuck in a loop must not flood the inbox (a soft limit, bursts of parallel requests can overshoot slightly). */
export const FEEDBACK_RATE_LIMIT_PER_HOUR = 30;

/** The same summary about the same tool on the same UTC day is one entry; the database enforces it with a unique index. */
export const feedbackDedupeKey = (summary: string, tool: string | null | undefined, at: Date) =>
  `${normalizeFeedbackSummary(summary)}|${tool ?? ""}|${at.toISOString().slice(0, 10)}`;

export const normalizeFeedbackSummary = (summary: string) => summary.trim().replace(/\s+/g, " ").toLowerCase();
