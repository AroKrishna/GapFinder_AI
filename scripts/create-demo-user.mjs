// Creates (or resets) a confirmed demo account for judges using the Supabase Admin API.
// Usage: node --env-file=.env.local scripts/create-demo-user.mjs judge@gapfinder.demo 'SomePassword!'
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never run this in the browser.
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !password || password.length < 8) {
  console.error("Usage: node --env-file=.env.local scripts/create-demo-user.mjs <email> <password (8+ chars)>");
  process.exit(1);
}
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  if (error) throw error;
  console.log(`Updated password for existing demo user ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Demo Judge" } });
  if (error) throw error;
  console.log(`Created demo user ${email}`);
}
