import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error("Not authenticated");
  return identity.subject as Id<"users">;
}

async function getOwnedTodo(ctx: MutationCtx, id: Id<"todos">) {
  const userId = await requireUserId(ctx);
  const todo = await ctx.db.get("todos", id);
  if (todo === null || todo.userId !== userId) {
    throw new Error("Todo not found");
  }
  return todo;
}

// .collect() is intentional: per-user todo list, bounded by UX.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return [];
    const userId = identity.subject as Id<"users">;
    return await ctx.db
      .query("todos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await requireUserId(ctx);
    const trimmed = text.trim();
    if (trimmed === "") throw new Error("Empty todo");
    return await ctx.db.insert("todos", {
      userId,
      text: trimmed,
      completed: false,
    });
  },
});

export const setCompleted = mutation({
  args: { id: v.id("todos"), completed: v.boolean() },
  handler: async (ctx, { id, completed }) => {
    await getOwnedTodo(ctx, id);
    await ctx.db.patch("todos", id, { completed });
  },
});

export const rename = mutation({
  args: { id: v.id("todos"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    await getOwnedTodo(ctx, id);
    const trimmed = text.trim();
    if (trimmed === "") {
      await ctx.db.delete("todos", id);
    } else {
      await ctx.db.patch("todos", id, { text: trimmed });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, { id }) => {
    await getOwnedTodo(ctx, id);
    await ctx.db.delete("todos", id);
  },
});

export const toggleAll = mutation({
  args: { completed: v.boolean() },
  handler: async (ctx, { completed }) => {
    const userId = await requireUserId(ctx);
    const todos = await ctx.db
      .query("todos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const todo of todos) {
      if (todo.completed !== completed) {
        await ctx.db.patch("todos", todo._id, { completed });
      }
    }
  },
});

export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const done = await ctx.db
      .query("todos")
      .withIndex("by_user_and_completed", (q) =>
        q.eq("userId", userId).eq("completed", true),
      )
      .collect();
    for (const todo of done) {
      await ctx.db.delete("todos", todo._id);
    }
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    const user = await ctx.db.get("users", identity.subject as Id<"users">);
    return user?.email ?? null;
  },
});
