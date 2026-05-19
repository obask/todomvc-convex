import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const create = internalMutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing !== null) {
      throw new Error("An account with that email already exists.");
    }
    return await ctx.db.insert("users", args);
  },
});
