import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "convex-simple-auth/server";

export default defineSchema({
  ...authTables,
  todos: defineTable({
    userId: v.string(),
    text: v.string(),
    completed: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "completed"]),
});
