import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { account, session, user } from "./auth-schema";

export * from "./auth-schema";

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "paused",
  "completed",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: projectStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_user_id_idx").on(t.userId)],
);

export const devLogs = pgTable(
  "dev_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    // KST 달력 날짜 'YYYY-MM-DD'
    logDate: date("log_date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    workDone: text("work_done").notNull().default(""),
    learned: text("learned").notNull().default(""),
    problems: text("problems").notNull().default(""),
    solutions: text("solutions").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dev_logs_user_id_log_date_idx").on(t.userId, t.logDate)],
);

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // KST 월요일 'YYYY-MM-DD'
    weekStart: date("week_start", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("weekly_reviews_user_id_week_start_unique").on(t.userId, t.weekStart)],
);

// user 관계는 테이블당 한 번만 정의해야 하므로 인증/앱 관계를 여기서 함께 선언한다.
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  projects: many(projects),
  devLogs: many(devLogs),
  weeklyReviews: many(weeklyReviews),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(user, { fields: [projects.userId], references: [user.id] }),
  devLogs: many(devLogs),
}));

export const devLogsRelations = relations(devLogs, ({ one }) => ({
  user: one(user, { fields: [devLogs.userId], references: [user.id] }),
  project: one(projects, {
    fields: [devLogs.projectId],
    references: [projects.id],
  }),
}));

export const weeklyReviewsRelations = relations(weeklyReviews, ({ one }) => ({
  user: one(user, { fields: [weeklyReviews.userId], references: [user.id] }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type DevLog = typeof devLogs.$inferSelect;
export type NewDevLog = typeof devLogs.$inferInsert;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;
export type NewWeeklyReview = typeof weeklyReviews.$inferInsert;
