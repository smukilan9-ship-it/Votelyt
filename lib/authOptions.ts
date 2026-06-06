import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Returned object is encoded into the JWT (see callbacks below).
        return { id: user.id, name: user.username, role: user.role } as {
          id: string;
          name: string;
          role: string;
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: stamp identity and role into the JWT.
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        return token;
      }
      // Keep role changes fresh for existing sessions.
      if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (!current) {
          token.invalid = true;
        } else {
          token.role = current.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // A stale/invalidated token yields a session with no user → treated as
      // logged out by getCurrentUser / requireUser.
      if (token.invalid || !token.id) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
