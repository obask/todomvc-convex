import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const maxTodos = 200;

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("guestTodos")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .take(maxTodos);
  },
});

export const create = mutation({
  args: { sessionId: v.string(), text: v.string() },
  handler: async (ctx, { sessionId, text }) => {
    const trimmed = text.trim();
    if (trimmed === "") throw new Error("Empty todo");
    return await ctx.db.insert("guestTodos", {
      sessionId,
      text: trimmed,
      completed: false,
    });
  },
});

export const setCompleted = mutation({
  args: { id: v.id("guestTodos"), completed: v.boolean() },
  handler: async (ctx, { id, completed }) => {
    await ctx.db.patch("guestTodos", id, { completed });
  },
});

export const rename = mutation({
  args: { id: v.id("guestTodos"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const trimmed = text.trim();
    if (trimmed === "") {
      await ctx.db.delete("guestTodos", id);
    } else {
      await ctx.db.patch("guestTodos", id, { text: trimmed });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("guestTodos") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete("guestTodos", id);
  },
});

export const toggleAll = mutation({
  args: { sessionId: v.string(), completed: v.boolean() },
  handler: async (ctx, { sessionId, completed }) => {
    const todos = await ctx.db
      .query("guestTodos")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .take(maxTodos);
    for (const todo of todos) {
      if (todo.completed !== completed) {
        await ctx.db.patch("guestTodos", todo._id, { completed });
      }
    }
  },
});

export const clearCompleted = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const done = await ctx.db
      .query("guestTodos")
      .withIndex("by_sessionId_and_completed", (q) =>
        q.eq("sessionId", sessionId).eq("completed", true),
      )
      .take(maxTodos);
    for (const todo of done) {
      await ctx.db.delete("guestTodos", todo._id);
    }
  },
});
