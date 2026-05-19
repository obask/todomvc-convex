import { defineTable } from "convex/server";
import { v } from "convex/values";

export const authTables = {
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
  }).index("by_email", ["email"]),
};
