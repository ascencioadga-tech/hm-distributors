// HM Distributors — user management for the Daily Quote System.
//
// The quote tool POSTs here to list, add or remove HM users. Creating an
// account needs Supabase's service-role key, which must never reach the
// browser, so it lives in the Netlify env (SUPABASE_SERVICE_ROLE_KEY) and
// only this function uses it. Every request must carry the caller's own
// Supabase session token; anyone not signed in to the tool is refused.
//
// Usernames become login emails on a domain HM owns (no mailbox needed):
//   rene  ->  rene@users.hmdistributors.com
// The person's real email is kept in user metadata for display.

const SUPABASE_URL = "https://ubdvcjrrbvyibrnvsswo.supabase.co";
const ANON_KEY = "sb_publishable_8QQJe8SM62Tc-9TKFCqOGg_TCa72cvE";
const LOGIN_DOMAIN = "users.hmdistributors.com";

type UserRow = { id: string; username: string; name: string; email: string; created_at: string; last_sign_in_at: string | null };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function usernameFor(u: { email?: string; user_metadata?: Record<string, string> }): string {
  if (u.user_metadata?.username) return u.user_metadata.username;
  return (u.email || "").split("@")[0];
}

function toRow(u: any): UserRow {
  return {
    id: u.id,
    username: usernameFor(u),
    name: u.user_metadata?.name || usernameFor(u),
    email: u.user_metadata?.contact_email || u.email || "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at || null,
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json(500, { error: "User management is not configured on the server." });

  // Who is asking? Must be a signed-in HM user.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in to manage users." });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return json(401, { error: "Your session has expired. Sign in again." });
  const caller = await who.json();

  const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "Bad request" }); }

  if (body.action === "list") {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: admin });
    if (!r.ok) return json(502, { error: "Could not load users." });
    const data = await r.json();
    const users = (data.users || []).map(toRow).sort((a: UserRow, b: UserRow) => a.name.localeCompare(b.name));
    return json(200, { users, me: caller.id });
  }

  if (body.action === "create") {
    const username = String(body.username || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const contactEmail = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!/^[a-z0-9._-]{2,32}$/.test(username)) return json(400, { error: "Username: letters, numbers, dots or dashes only (2–32 characters)." });
    if (!name) return json(400, { error: "Enter the person's name." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) return json(400, { error: "Enter a valid email address." });
    if (password.length < 8) return json(400, { error: "Password must be at least 8 characters." });

    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({
        email: `${username}@${LOGIN_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { name, username, contact_email: contactEmail, created_by: caller.id },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = String(data.msg || data.message || data.error_description || "");
      return json(400, { error: /already|exists|registered/i.test(msg) ? "That username is already taken." : msg || "Could not create the user." });
    }
    return json(200, { user: toRow(data) });
  }

  if (body.action === "delete") {
    const id = String(body.id || "");
    if (!id) return json(400, { error: "Missing user id." });
    if (id === caller.id) return json(400, { error: "You can't remove your own account." });
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
    if (!r.ok) return json(502, { error: "Could not remove the user." });
    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown action" });
};
