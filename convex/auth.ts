import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  hashPassword,
  normalizeEmail,
  signJwt,
  verifyPassword,
} from "convex-simple-auth/server";

export const signUp = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<string> => {
    const e = normalizeEmail(email);
    if (!e || password.length < 8) {
      throw new Error(
        "Email is required and password must be at least 8 characters.",
      );
    }

    const existing = await ctx.runQuery(internal.users.getByEmail, {
      email: e,
    });
    if (existing !== null) {
      throw new Error("An account with that email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const userId = await ctx.runMutation(internal.users.create, {
      email: e,
      passwordHash,
    });
    return await signJwt(userId, { claims: { email: e } });
  },
});

export const signIn = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<string> => {
    const e = normalizeEmail(email);
    const user = await ctx.runQuery(internal.users.getByEmail, {
      email: e,
    });
    if (user === null || !user.passwordHash) {
      throw new Error("Invalid email or password.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) throw new Error("Invalid email or password.");

    return await signJwt(user._id, { claims: { email: e } });
  },
});
