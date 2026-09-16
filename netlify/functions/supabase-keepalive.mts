// HM Distributors — Supabase keep-alive.
//
// Free Supabase projects are paused after about 7 days without activity, which
// locks everyone out of the quote tool. This scheduled Netlify Function runs a
// small query against the database twice a week so the project never sits idle
// long enough to pause. Runs on Netlify's servers (production deploys only).
//
// The key below is the public publishable key already shipped in login.html and
// quote-tool.html; row-level security means this query only ever returns [].

const SUPABASE_URL = "https://ubdvcjrrbvyibrnvsswo.supabase.co";
const SUPABASE_KEY = "sb_publishable_8QQJe8SM62Tc-9TKFCqOGg_TCa72cvE";

export default async () => {
  const headers = { apikey: SUPABASE_KEY };
  const checks = {
    auth: `${SUPABASE_URL}/auth/v1/health`,
    database: `${SUPABASE_URL}/rest/v1/products?select=id&limit=1`,
  };

  const results: Record<string, number | string> = {};
  for (const [name, url] of Object.entries(checks)) {
    try {
      const res = await fetch(url, { headers });
      results[name] = res.status;
    } catch (err) {
      results[name] = `unreachable: ${(err as Error).message}`;
    }
  }

  const ok = Object.values(results).every((s) => s === 200);
  const line = `Supabase keep-alive ${ok ? "OK" : "FAILED"}: ${JSON.stringify(results)}`;
  if (ok) console.log(line);
  else console.error(line);

  return new Response(line, { status: ok ? 200 : 502 });
};

// Mondays and Thursdays at 14:00 UTC (7:00 AM Arizona). Twice a week keeps
// every gap under Supabase's 7-day idle window.
export const config = {
  schedule: "0 14 * * 1,4",
};
