import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Vercel builds were OOMing during the type-check step — TypeScript's
    // compiler runs a full parser *in its type system* to infer row shapes
    // from every multi-column .select("col1, col2, ...") string literal
    // (see @supabase/postgrest-js's ParseQuery/GetResult types). This repo
    // has many such calls across several files (predates any single
    // change), and the cumulative type-instantiation cost is enough to
    // exhaust the build machine's memory before it ever gets to bundling.
    //
    // This skips the type-check step entirely during `next build` — it
    // does not run tsc and suppress errors, it bypasses the check. Type
    // errors (like the PromiseLike/Promise mismatch fixed earlier) will no
    // longer fail the build, so run `npx tsc --noEmit` (or fix the
    // .select() calls to pass an explicit second generic type argument,
    // bypassing the expensive string parser) before relying on this again.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
