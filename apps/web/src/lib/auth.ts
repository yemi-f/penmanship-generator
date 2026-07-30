import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js v5 only trusts the request's Host header automatically in dev or on Vercel;
  // on any other platform (Railway included) it fails closed with UntrustedHost unless
  // told to trust it explicitly.
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.picture = (profile as { picture?: string }).picture ?? token.picture;
        // Auth.js has no adapter configured, so its default adapter-less OAuth flow
        // discards Google's stable account sub and assigns a fresh crypto.randomUUID()
        // to user.id on every sign-in. Pin token.sub back to the real Google sub here
        // so session.user.id (and the B2 users/{user_id}/ prefix derived from it) stays
        // stable across sign-out/sign-in for the same account.
        const googleSub = (profile as { sub?: string }).sub;
        if (typeof googleSub === "string") {
          token.sub = googleSub;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
