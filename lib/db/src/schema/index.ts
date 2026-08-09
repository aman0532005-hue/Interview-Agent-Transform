import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "interview_users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("interview_users_email_idx").on(table.email),
  }),
);

export const interviewsTable = pgTable("interviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull(),
  interviewType: text("interview_type").notNull(),
  difficulty: text("difficulty").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  overallScore: integer("overall_score"),
  summary: text("summary"),
  candidateContext: jsonb("candidate_context").notNull().default({}),
  engineState: jsonb("engine_state").notNull().default({}),
});

export const questionsTable = pgTable(
  "interview_questions",
  {
    id: text("id").primaryKey(),
    interviewId: text("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    topic: text("topic").notNull(),
    difficulty: text("difficulty").notNull(),
    sequence: integer("sequence").notNull(),
    type: text("type").notNull().default("technical"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    interviewSequenceIdx: uniqueIndex("interview_questions_sequence_idx").on(table.interviewId, table.sequence),
  }),
);

export const answersTable = pgTable(
  "interview_answers",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
    interviewId: text("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    duration: integer("duration"),
  },
  (table) => ({
    questionOnceIdx: uniqueIndex("interview_answers_question_once_idx").on(table.questionId),
  }),
);

export const evaluationsTable = pgTable(
  "interview_evaluations",
  {
    id: text("id").primaryKey(),
    answerId: text("answer_id").notNull().references(() => answersTable.id, { onDelete: "cascade" }),
    interviewId: text("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
    correctness: real("correctness").notNull(),
    relevance: real("relevance").notNull(),
    completeness: real("completeness").notNull(),
    depth: real("depth").notNull(),
    communication: real("communication").notNull(),
    overallScore: real("overall_score").notNull(),
    verdict: text("verdict").notNull(),
    strengths: jsonb("strengths").notNull().default([]),
    mistakes: jsonb("mistakes").notNull().default([]),
    missingConcepts: jsonb("missing_concepts").notNull().default([]),
    misconceptions: jsonb("misconceptions").notNull().default([]),
    feedback: text("feedback").notNull(),
    nextAction: text("next_action").notNull(),
    needsFollowUp: boolean("needs_follow_up").notNull().default(false),
  },
  (table) => ({
    answerOnceIdx: uniqueIndex("interview_evaluations_answer_once_idx").on(table.answerId),
  }),
);

export const reportsTable = pgTable(
  "interview_reports",
  {
    id: text("id").primaryKey(),
    interviewId: text("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    strengths: jsonb("strengths").notNull().default([]),
    weaknesses: jsonb("weaknesses").notNull().default([]),
    knowledgeGaps: jsonb("knowledge_gaps").notNull().default([]),
    recommendedTopics: jsonb("recommended_topics").notNull().default([]),
    summary: text("summary").notNull(),
    recommendation: text("recommendation").notNull(),
    reportData: jsonb("report_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    interviewOnceIdx: uniqueIndex("interview_reports_interview_once_idx").on(table.interviewId),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type Interview = typeof interviewsTable.$inferSelect;
export type InterviewQuestion = typeof questionsTable.$inferSelect;
export type InterviewAnswer = typeof answersTable.$inferSelect;
export type InterviewEvaluation = typeof evaluationsTable.$inferSelect;
export type InterviewReport = typeof reportsTable.$inferSelect;