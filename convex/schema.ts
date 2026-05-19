import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "./simpleAuth/schema";

export default defineSchema({
  ...authTables,
  todos: defineTable({
    userId: v.id("users"),
    text: v.string(),
    completed: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "completed"]),
});
