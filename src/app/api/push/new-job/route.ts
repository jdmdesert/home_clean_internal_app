import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:owner@example.com";
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return Response.json({ error: "Push service is not configured." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: owner } = await admin.from("profiles").select("id").eq("id", userData.user.id)
    .eq("role", "owner").eq("active", true).maybeSingle();
  if (!owner) return Response.json({ error: "Owner access required." }, { status: 403 });

  const body = await request.json() as { jobId?: string; title?: string; area?: string; date?: string };
  if (!body.jobId) return Response.json({ error: "Missing job ID." }, { status: 400 });
  const { data: subscriptions, error } = await admin.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, profiles!inner(role, active)")
    .eq("profiles.role", "employee").eq("profiles.active", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({
    title: "New cleaning job available",
    body: `${body.title || "Cleaning job"} · ${body.area || "Open the app for details"}`,
    url: `/?job=${encodeURIComponent(body.jobId)}`,
  });
  let sent = 0;
  await Promise.all((subscriptions || []).map(async (item) => {
    try {
      await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, payload);
      sent += 1;
    } catch (pushError) {
      const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError
        ? Number(pushError.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", item.id);
    }
  }));
  return Response.json({ sent });
}
