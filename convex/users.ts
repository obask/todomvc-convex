import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique(),
});

export const create = internalMutation({
  args: {
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("users", args),
});
