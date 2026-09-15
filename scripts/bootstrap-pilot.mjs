import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PILOT_INITIAL_PASSWORD",
  "PILOT_OWNER_1_EMAIL", "PILOT_OWNER_2_EMAIL",
  "PILOT_EMPLOYEE_1_EMAIL", "PILOT_EMPLOYEE_2_EMAIL",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const accounts = [
  { email: process.env.PILOT_OWNER_1_EMAIL, name: process.env.PILOT_OWNER_1_NAME || "Primary Owner", role: "owner" },
  { email: process.env.PILOT_OWNER_2_EMAIL, name: process.env.PILOT_OWNER_2_NAME || "Backup Owner", role: "owner" },
  { email: process.env.PILOT_EMPLOYEE_1_EMAIL, name: process.env.PILOT_EMPLOYEE_1_NAME || "Test Cleaner One", role: "employee" },
  { email: process.env.PILOT_EMPLOYEE_2_EMAIL, name: process.env.PILOT_EMPLOYEE_2_NAME || "Test Cleaner Two", role: "employee" },
];

const { data: existingData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const account of accounts) {
  let user = existingData.users.find((item) => item.email?.toLowerCase() === account.email.toLowerCase());
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: process.env.PILOT_INITIAL_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.name },
    });
    if (error) throw error;
    user = data.user;
  }

  const nameParts = account.name.trim().split(/\s+/);
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    full_name: account.name,
    first_name: nameParts[0] || account.name,
    last_name: nameParts.slice(1).join(" ") || "Account",
    role: account.role,
    preferred_language: "English",
    onboarding_complete: true,
    active: true,
  });
  if (profileError) throw profileError;
  console.log(`Ready: ${account.role.padEnd(8)} ${account.email}`);
}

console.log("Pilot accounts are ready. Share the initial password securely and change it before launch.");
