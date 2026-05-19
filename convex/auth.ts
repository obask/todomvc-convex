import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashPassword, verifyPassword } from "./simpleAuth/password";
import { signJwt } from "./simpleAuth/jwt";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const signUp = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<string> => {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail === "" || password.length < 8) {
      throw new Error(
        "Email is required and password must be at least 8 characters.",
      );
    }

    const existing = await ctx.runQuery(internal.users.getByEmail, {
      email: normalizedEmail,
    });
    if (existing !== null) {
      throw new Error("An account with that email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const userId = await ctx.runMutation(internal.users.create, {
      email: normalizedEmail,
      passwordHash,
    });
    return await signJwt({ sub: userId, claims: { email: normalizedEmail } });
  },
});

export const signIn = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<string> => {
    const normalizedEmail = normalizeEmail(email);
    const user = await ctx.runQuery(internal.users.getByEmail, {
      email: normalizedEmail,
    });
    if (user === null) throw new Error("Invalid email or password.");

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) throw new Error("Invalid email or password.");

    return await signJwt({
      sub: user._id,
      claims: { email: normalizedEmail },
    });
  },
});
