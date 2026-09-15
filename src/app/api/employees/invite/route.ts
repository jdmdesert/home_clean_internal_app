import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return Response.json({ error: "Employee invitations are not configured yet." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: owner } = await admin.from("profiles").select("id").eq("id", userData.user.id)
    .eq("role", "owner").eq("active", true).maybeSingle();
  if (!owner) return Response.json({ error: "Owner access required." }, { status: 403 });

  const body = await request.json() as { name?: string; email?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Enter the employee’s full name and a valid email address." }, { status: 400 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://steadfast-cleaning.netlify.app").replace(/\/$/, "");
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name, role: "employee" }, redirectTo: `${siteUrl}/?invite=1`,
  });
  if (inviteError || !invitation.user) {
    const message = inviteError?.message || "Supabase could not create the invitation.";
    return Response.json({ error: message.includes("already") ? "An account already exists for this email address." : message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invitation.user.id, full_name: name, email, role: "employee", active: false, onboarding_complete: false,
  }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(invitation.user.id);
    return Response.json({ error: `Invitation profile could not be created: ${profileError.message}` }, { status: 500 });
  }
  return Response.json({ invited: true });
}
