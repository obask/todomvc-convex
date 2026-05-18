import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  todos: defineTable({
    userId: v.id("users"),
    text: v.string(),
    completed: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "completed"]),
  guestTodos: defineTable({
    sessionId: v.string(),
    text: v.string(),
    completed: v.boolean(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_completed", ["sessionId", "completed"]),
});
