import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) {
    return Response.json({ error: "Password resets are not configured yet." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: owner, error: ownerError } = await userClient.from("profiles").select("id")
    .eq("id", userData.user.id).eq("role", "owner").eq("active", true).maybeSingle();
  if (ownerError) return Response.json({ error: `Owner verification failed: ${ownerError.message}` }, { status: 500 });
  if (!owner) return Response.json({ error: "Owner access required." }, { status: 403 });

  const body = await request.json() as { employeeId?: string };
  if (!body.employeeId) return Response.json({ error: "Employee account is required." }, { status: 400 });
  const { data: employee, error: employeeError } = await admin.from("profiles").select("email, role")
    .eq("id", body.employeeId).eq("role", "employee").maybeSingle();
  if (employeeError) return Response.json({ error: employeeError.message }, { status: 500 });
  if (!employee?.email) return Response.json({ error: "This employee does not have an email address." }, { status: 404 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://steadfast-cleaning.netlify.app").replace(/\/$/, "");
  const { error: resetError } = await admin.auth.resetPasswordForEmail(employee.email, {
    redirectTo: `${siteUrl}/?recovery=1`,
  });
  if (resetError) return Response.json({ error: resetError.message }, { status: 400 });
  return Response.json({ sent: true });
}
