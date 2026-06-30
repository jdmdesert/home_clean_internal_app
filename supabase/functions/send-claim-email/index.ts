declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("CLAIM_WEBHOOK_SECRET");
  if (!webhookSecret || request.headers.get("authorization") !== `Bearer ${webhookSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("CLAIM_EMAIL_FROM");
  if (!apiKey || !from) {
    return new Response("Email service is not configured", { status: 503 });
  }

  const payload = await request.json();
  const email = payload.record;
  if (!email?.id || !email?.recipient || !email?.subject || !email?.body) {
    return new Response("Invalid webhook payload", { status: 400 });
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `claim-email-${email.id}`,
    },
    body: JSON.stringify({
      from,
      to: [email.recipient],
      subject: email.subject,
      text: email.body,
    }),
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: 502 });
  }

  return new Response(await response.text(), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
