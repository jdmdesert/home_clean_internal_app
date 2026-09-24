"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmployeeDirectory } from "@/components/employee-directory";
import { EmployeeRegistration, type EmployeeProfile } from "@/components/employee-registration";
import { NotificationButton } from "@/components/notification-button";
import { createId } from "@/lib/create-id";
import { useAppLanguage } from "@/lib/language";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type Role = "owner" | "employee";
type Status = "open" | "claimed" | "completed";
type WorkBlock = {
  id: string; title: string; date: string; startTime: string; endTime: string;
  city: string; zip: string; squareFeet: number; address: string; accessCodes: string;
  pay: number; details: string[]; notes: string;
  occupancy: "vacant" | "occupied"; ownersPresent?: boolean;
  status: Status; claimedBy?: string;
};

type AccountProfile = {
  id: string; full_name: string; first_name: string | null; last_name: string | null;
  email: string | null; phone: string | null; address: string | null;
  preferred_language: string | null; role: Role; active: boolean; onboarding_complete: boolean;
};
type WorkBlockRow = {
  id: string; title: string; starts_at: string; ends_at: string; city: string;
  postal_code: string; square_feet: number; occupancy: "vacant" | "occupied";
  owners_present: boolean | null; employee_pay: number; tasks: string[];
  status: Status; claimed_by: string | null;
  work_block_private_details?: Array<{ address: string; access_codes: string | null; private_notes: string | null }>;
};

function rowToBlock(row: WorkBlockRow, employeeNames: Map<string, string>): WorkBlock {
  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);
  const privateDetails = row.work_block_private_details?.[0];
  return {
    id: row.id, title: row.title, date: starts.toLocaleDateString("en-CA"),
    startTime: starts.toTimeString().slice(0, 5), endTime: ends.toTimeString().slice(0, 5),
    city: row.city, zip: row.postal_code, squareFeet: row.square_feet,
    address: privateDetails?.address || "", accessCodes: privateDetails?.access_codes || "",
    pay: Number(row.employee_pay), details: row.tasks || [], notes: privateDetails?.private_notes || "",
    occupancy: row.occupancy, ownersPresent: row.owners_present ?? undefined,
    status: row.status, claimedBy: row.claimed_by ? employeeNames.get(row.claimed_by) || "Assigned employee" : undefined,
  };
}

const jobTemplates: Record<string, string[]> = {
  "Airbnb Cleaning": ["Clean and sanitize kitchen", "Clean bathrooms", "Change linens", "Restock guest supplies", "Vacuum and mop all floors"],
  "Move-out Cleaning": ["Deep clean kitchen and appliances", "Clean inside cabinets", "Clean bathrooms", "Wipe baseboards", "Vacuum and mop all floors"],
  "Recurring Cleaning": ["Clean kitchen surfaces", "Clean bathrooms", "Dust accessible surfaces", "Vacuum and mop all floors", "Empty trash"],
  "Deep Cleaning": ["Deep clean kitchen", "Scrub bathrooms", "Dust blinds and fans", "Wipe doors and baseboards", "Vacuum and mop all floors"],
  "Custom Job": [],
};

const seedBlocks: WorkBlock[] = [
  { id: "seed-1", title: "Move-out Cleaning", date: "2026-07-02", startTime: "09:00", endTime: "13:00",
    city: "Scottsdale", zip: "85254", address: "7420 E. Desert Cove Ave, Scottsdale, AZ 85254", pay: 120,
    squareFeet: 1850, accessCodes: "Gate: #2468 · Front door keypad: 1937",
    details: ["3 bed / 2 bath", "Inside oven", "Inside cabinets"],
    notes: "Lockbox details appear after acceptance.", occupancy: "vacant", status: "open" },
  { id: "seed-2", title: "Airbnb Cleaning", date: "2026-07-03", startTime: "13:30", endTime: "16:30",
    city: "Paradise Valley", zip: "85253", address: "5114 N. Mockingbird Ln, Paradise Valley, AZ 85253", pay: 90,
    squareFeet: 1420, accessCodes: "Side gate: 5522 · Keypad: 7814",
    details: ["2 bed / 2 bath", "Standard clean", "Pet-friendly products"],
    notes: "One friendly dog will be home.", occupancy: "occupied", ownersPresent: false, status: "open" },
];

const seedEmployees: EmployeeProfile[] = [
  { id: "employee-maria", language: "English", firstName: "Maria", lastName: "Rodriguez",
    name: "Maria Rodriguez", dateOfBirth: "1991-04-18",
    email: "maria@example.com", address: "", phone: "(602) 555-0142", paymentMethod: "Zelle",
    paymentContact: "(602) 555-0142", serviceArea: "Scottsdale, Paradise Valley",
    emergencyContact: "Elena Rodriguez · (602) 555-0199", joinedAt: "2025-10-12T12:00:00Z", active: true,
    standing: "good", score: 94, standingNote: "Strong attendance and consistently positive feedback.",
    completedJobs: 48, attendanceRate: 98, paidMonth: 720, paidYear: 6840, paidLifetime: 9320 },
  { id: "employee-jasmine", language: "English", firstName: "Jasmine", lastName: "Lee",
    name: "Jasmine Lee", dateOfBirth: "1996-09-03",
    email: "jasmine@example.com", address: "", phone: "(480) 555-0168", paymentMethod: "ACH",
    paymentContact: "Secure payout account connected", serviceArea: "Phoenix, Tempe",
    emergencyContact: "", joinedAt: "2026-01-08T12:00:00Z", active: false, standing: "watch", score: 72,
    standingNote: "Two recent late arrivals; owner follow-up recommended.",
    completedJobs: 21, attendanceRate: 86, paidMonth: 450, paidYear: 3380, paidLifetime: 3380 },
  { id: "employee-sofia", language: "Español", firstName: "Sofia", lastName: "Martinez",
    name: "Sofia Martinez", dateOfBirth: "1989-12-11",
    email: "sofia@example.com", address: "", phone: "(623) 555-0115", paymentMethod: "Zelle",
    paymentContact: "sofia@example.com", serviceArea: "Glendale, Phoenix",
    emergencyContact: "", joinedAt: "2026-06-20T12:00:00Z", active: true, standing: "new", score: null,
    standingNote: "Not enough work history to calculate a standing.",
    completedJobs: 1, attendanceRate: null, paidMonth: 95, paidYear: 95, paidLifetime: 95 },
];

const day = (value: string) => new Intl.DateTimeFormat("en-US",
  { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
const time = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2026, 0, 1, hours, minutes));
};

function initialsFor(name?: string) {
  if (!name) return "SC";
  const displayName = name.includes("@") ? name.split("@")[0].replace(/[._-]+/g, " ") : name;
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function accountInitials(account: AccountProfile | null) {
  const first = account?.first_name?.trim();
  const last = account?.last_name?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return initialsFor(account?.full_name);
}

function firstNameFor(account: AccountProfile | null) {
  return account?.first_name?.trim() || account?.full_name?.trim().split(/\s+/)[0] || "there";
}

const openedFromPasswordRecovery = typeof window !== "undefined" && (
  new URLSearchParams(window.location.search).get("recovery") === "1"
  || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
);

export default function Home() {
  const { spanish, setLanguage: setPreferredLanguage } = useAppLanguage();
  const [role, setRole] = useState<Role>("employee");
  const [blocks, setBlocks] = useState<WorkBlock[]>(seedBlocks);
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<WorkBlock | null>(null);
  const [toast, setToast] = useState("");
  const [ownerAlerts, setOwnerAlerts] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>(seedEmployees);
  const [showRegistration, setShowRegistration] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [appError, setAppError] = useState("");
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  async function loadProductionData(currentSession: Session) {
    if (!supabase) return;
    setAccountMenuOpen(false);
    setAppError("");
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id, full_name, first_name, last_name, email, phone, address, preferred_language, role, active, onboarding_complete").eq("id", currentSession.user.id).single();
    if (profileError || !profile) {
      setAppError("This account has not been added to the cleaning team yet.");
      setLoading(false);
      return;
    }
    const typedProfile = profile as AccountProfile;
    setAccount(typedProfile);
    setRole(typedProfile.role);
    if (typedProfile.role === "employee" && !typedProfile.onboarding_complete) setShowRegistration(true);

    const { data: profileRows } = typedProfile.role === "owner"
      ? await supabase.from("profiles").select("*").eq("role", "employee").order("full_name")
      : { data: [] };
    const names = new Map<string, string>((profileRows || []).map((item) => [item.id, item.full_name]));
    names.set(typedProfile.id, typedProfile.full_name);

    const { data: workRows, error: workError } = await supabase
      .from("work_blocks")
      .select("*, work_block_private_details(address, access_codes, private_notes)")
      .order("starts_at", { ascending: true });
    if (workError) setAppError(workError.message);
    else setBlocks(((workRows || []) as WorkBlockRow[]).map((row) => rowToBlock(row, names)));

    if (typedProfile.role === "owner") {
      setEmployees((profileRows || []).map((item) => ({
        id: item.id, language: item.preferred_language || "English",
        firstName: item.first_name || "", lastName: item.last_name || "", name: item.full_name,
        dateOfBirth: item.date_of_birth || "", email: item.email || "Managed through login", address: item.address || "", phone: item.phone || "",
        paymentMethod: item.payment_method || "Other", paymentContact: item.payment_contact || "",
        serviceArea: item.service_area || "", emergencyContact: item.emergency_contact || "",
        joinedAt: item.created_at, active: item.active, standing: item.standing,
        score: item.performance_score, standingNote: item.standing_note || "",
        completedJobs: 0, attendanceRate: null, paidMonth: 0, paidYear: 0, paidLifetime: 0,
      })) as EmployeeProfile[]);
      const { data: alerts } = await supabase.from("owner_notifications")
        .select("message").order("created_at", { ascending: false }).limit(10);
      setOwnerAlerts((alerts || []).map((item) => item.message));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 8000);
    if (openedFromPasswordRecovery) queueMicrotask(() => {
      if (active) setRecoveringPassword(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      window.clearTimeout(loadingTimer);
      setSession(data.session);
      if (data.session && !openedFromPasswordRecovery) void loadProductionData(data.session);
      else setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      setSession(nextSession);
      if (nextSession) void loadProductionData(nextSession);
      else { setAccount(null); setLoading(false); }
    });
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    const channel = client.channel("work-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_blocks" },
        () => void loadProductionData(session))
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const saved = localStorage.getItem("dhc-demo-blocks");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<WorkBlock & { duration?: number; area?: string }>;
      const compatible = parsed.every((block) =>
        block.endTime && block.city && block.zip && block.occupancy && block.squareFeet);
      if (compatible) queueMicrotask(() => setBlocks(parsed));
    }
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem("dhc-demo-blocks", JSON.stringify(blocks));
  }, [blocks]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const saved = localStorage.getItem("dhc-demo-employees");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<EmployeeProfile & {
        active?: boolean; firstName?: string; lastName?: string; dateOfBirth?: string;
      }>;
      queueMicrotask(() => setEmployees(parsed.map((employee) => {
        const parts = employee.name.trim().split(/\s+/);
        return { ...employee, active: employee.active ?? true,
          firstName: employee.firstName || parts[0] || "",
          lastName: employee.lastName || parts.slice(1).join(" "),
          dateOfBirth: employee.dateOfBirth || "" };
      })));
    }
    if (!localStorage.getItem("dhc-demo-onboarded")) queueMicrotask(() => setShowRegistration(true));
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem("dhc-demo-employees", JSON.stringify(employees));
  }, [employees]);

  const available = blocks.filter((block) => block.status === "open");
  const mine = blocks.filter((block) => block.claimedBy === (account?.full_name || "Maria"));
  const shown = tab === "available" ? available : mine;

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }
  async function signOut() {
    if (!supabase) return;
    const clearLocalAuth = () => {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
        .forEach((key) => window.localStorage.removeItem(key));
    };
    setAccountMenuOpen(false);
    setEditingProfile(false);
    setShowRegistration(false);
    setAccount(null);
    setSession(null);
    setAppError("");
    setLoading(false);
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => window.setTimeout(resolve, 2000)),
      ]);
    } finally {
      clearLocalAuth();
      setAccount(null);
      setSession(null);
      window.location.replace(window.location.origin);
    }
  }
  async function claim(id: string) {
    if (supabase && session) {
      const { data, error } = await supabase.rpc("claim_work_block", { block_id: id });
      if (error) return notify(error.message);
      if (!data?.[0]?.claimed) return notify("Another cleaner accepted this job first.");
      notify("You got it! The address is now unlocked.");
      setTab("mine");
      await loadProductionData(session);
      return;
    }
    const claimedBlock = blocks.find((block) => block.id === id);
    setBlocks((current) => current.map((block) =>
      block.id === id && block.status === "open"
        ? { ...block, status: "claimed", claimedBy: "Maria" } : block));
    notify("You got it! The address is now unlocked.");
    if (claimedBlock) {
      setOwnerAlerts((current) => [
        `Maria accepted ${claimedBlock.title} in ${claimedBlock.city} for ${day(claimedBlock.date)}.`,
        ...current,
      ]);
    }
    setTab("mine");
  }
  async function createBlock(block: WorkBlock) {
    if (supabase && session) {
      const startsAt = new Date(`${block.date}T${block.startTime}:00`).toISOString();
      const endsAt = new Date(`${block.date}T${block.endTime}:00`).toISOString();
      const { data: created, error } = await supabase.from("work_blocks").insert({
        title: block.title, starts_at: startsAt, ends_at: endsAt, city: block.city,
        postal_code: block.zip, square_feet: block.squareFeet, occupancy: block.occupancy,
        owners_present: block.occupancy === "occupied" ? Boolean(block.ownersPresent) : null,
        employee_pay: block.pay, tasks: block.details, created_by: session.user.id,
      }).select("id").single();
      if (error || !created) return notify(error?.message || "Could not create the job.");
      const { error: privateError } = await supabase.from("work_block_private_details").insert({
        work_block_id: created.id, address: block.address, access_codes: block.accessCodes || null,
        private_notes: block.notes || null,
      });
      if (privateError) return notify(`Job created, but private details failed: ${privateError.message}`);
      const { data: authData } = await supabase.auth.getSession();
      let notificationMessage = "Work block posted to the team.";
      if (authData.session) {
        try {
          const pushResponse = await fetch("/api/push/new-job", {
            method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${authData.session.access_token}` },
            body: JSON.stringify({ jobId: created.id, title: block.title, area: `${block.city}, AZ`, date: block.date }),
          });
          const pushResult = await pushResponse.json() as { sent?: number; error?: string };
          notificationMessage = pushResponse.ok
            ? `Work posted. ${pushResult.sent || 0} employee device${pushResult.sent === 1 ? "" : "s"} notified.`
            : `Work posted, but push notifications failed: ${pushResult.error || "Service unavailable"}`;
        } catch {
          notificationMessage = "Work posted, but the notification service could not be reached.";
        }
      }
      setShowForm(false);
      notify(notificationMessage);
      await loadProductionData(session);
      return;
    }
    setBlocks((current) => [block, ...current]);
    setShowForm(false);
    notify("Work block posted to the team.");
  }
  async function unassignBlock(id: string) {
    const block = blocks.find((item) => item.id === id);
    if (!block?.claimedBy) return;
    if (!window.confirm(`Remove ${block.claimedBy} from this job and make it available again?`)) return;
    if (supabase && session) {
      const { data, error } = await supabase.rpc("unassign_work_block", { block_id: id });
      if (error || !data) return notify(error?.message || "The assignment could not be removed.");
      notify("Assignment removed. The work block is available again.");
      await loadProductionData(session);
      return;
    }
    setBlocks((current) => current.map((item) =>
      item.id === id ? { ...item, status: "open", claimedBy: undefined } : item));
    notify("Assignment removed. The work block is available again.");
  }
  async function updateBlock(block: WorkBlock) {
    if (supabase && session) {
      const startsAt = new Date(`${block.date}T${block.startTime}:00`).toISOString();
      const endsAt = new Date(`${block.date}T${block.endTime}:00`).toISOString();
      const { error } = await supabase.from("work_blocks").update({
        title: block.title, starts_at: startsAt, ends_at: endsAt, city: block.city,
        postal_code: block.zip, square_feet: block.squareFeet, occupancy: block.occupancy,
        owners_present: block.occupancy === "occupied" ? Boolean(block.ownersPresent) : null,
        employee_pay: block.pay, tasks: block.details,
      }).eq("id", block.id);
      if (error) return notify(error.message);
      const { error: privateError } = await supabase.from("work_block_private_details").update({
        address: block.address, access_codes: block.accessCodes || null,
        private_notes: block.notes || null,
      }).eq("work_block_id", block.id);
      if (privateError) return notify(privateError.message);
      setEditingBlock(null);
      notify("Work block updated.");
      await loadProductionData(session);
      return;
    }
    setBlocks((current) => current.map((item) => item.id === block.id ? block : item));
    setEditingBlock(null);
    notify("Work block updated.");
  }
  async function assignBlock(id: string, employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    if (supabase && session) {
      const { error } = await supabase.from("work_blocks").update({
        status: "claimed", claimed_by: employeeId, claimed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return notify(error.message);
      notify(`Assigned to ${employee.name}.`);
      await loadProductionData(session);
      return;
    }
    setBlocks((current) => current.map((item) => item.id === id
      ? { ...item, status: "claimed", claimedBy: employee.name } : item));
    notify(`Assigned to ${employee.name}.`);
  }
  async function deleteBlock(id: string) {
    const block = blocks.find((item) => item.id === id);
    if (!block || !window.confirm(`Delete ${block.title}? This cannot be undone.`)) return;
    if (supabase && session) {
      const { error } = await supabase.from("work_blocks").delete().eq("id", id);
      if (error) return notify(error.message);
      notify("Work block deleted.");
      await loadProductionData(session);
      return;
    }
    setBlocks((current) => current.filter((item) => item.id !== id));
    notify("Work block deleted.");
  }
  async function completeRegistration(employee: EmployeeProfile, password: string) {
    if (supabase && session) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) return passwordError.message;
      const { error } = await supabase.rpc("register_employee", {
        first_name_input: employee.firstName, last_name_input: employee.lastName,
        date_of_birth_input: employee.dateOfBirth, language_input: employee.language,
        phone_input: employee.phone, address_input: employee.address,
        payment_method_input: employee.paymentMethod.toLowerCase(), payment_contact_input: employee.paymentContact,
        service_area_input: employee.serviceArea || null, emergency_contact_input: employee.emergencyContact || null,
      });
      if (error) return error.message;
      setShowRegistration(false);
      notify("Registration complete. Welcome to the team!");
      await loadProductionData(session);
      return;
    }
    setEmployees((current) => [employee, ...current]);
    localStorage.setItem("dhc-demo-onboarded", "true");
    setShowRegistration(false);
    notify("Registration complete. Welcome to the team!");
  }
  async function inviteEmployee(firstName: string, lastName: string, email: string) {
    if (!session) return "Please sign in again before sending an invitation.";
    const response = await fetch("/api/employees/invite", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ firstName, lastName, email }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) return result.error || "The invitation could not be sent.";
    notify(`Invitation sent to ${email}.`);
    await loadProductionData(session);
  }
  async function setEmployeeActive(id: string, active: boolean) {
    if (supabase && session) {
      const { error } = await supabase.rpc("set_employee_active", { employee_id: id, active_input: active });
      if (error) return notify(error.message);
      notify(active ? "Employee account reactivated." : "Employee account deactivated.");
      await loadProductionData(session);
      return;
    }
    setEmployees((current) => current.map((employee) =>
      employee.id === id ? { ...employee, active } : employee));
    notify(active ? "Employee account reactivated." : "Employee account deactivated.");
  }

  async function updateOwnProfile(values: { firstName: string; lastName: string; email: string; phone: string; address: string; language: string }) {
    if (!supabase || !session) return "Please sign in again.";
    const nextEmail = values.email.trim().toLowerCase();
    const currentEmail = session.user.email?.toLowerCase() || account?.email?.toLowerCase();
    if (nextEmail && nextEmail !== currentEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
      if (emailError) return emailError.message;
    }
    const { error } = await supabase.rpc("update_own_profile", {
      first_name_input: values.firstName, last_name_input: values.lastName,
      email_input: nextEmail, phone_input: values.phone, address_input: values.address,
      language_input: values.language,
    });
    if (error) return error.message;
    setPreferredLanguage(values.language === "Español" ? "es" : "en");
    await loadProductionData(session);
    setEditingProfile(false);
    setAccountMenuOpen(false);
    notify(nextEmail !== currentEmail
      ? "Profile saved. Check your new email address to confirm the change."
      : "Profile updated.");
  }

  if (recoveringPassword) return <ResetPasswordScreen onDone={() => setRecoveringPassword(false)} />;
  if (loading) return <div className="auth-shell"><div className="auth-card"><h1>{spanish ? "Cargando tablero…" : "Loading work board…"}</h1></div></div>;
  if (isSupabaseConfigured && !session) return <LoginScreen />;
  if (isSupabaseConfigured && (!account || appError)) return <div className="auth-shell"><div className="auth-card">
    <h1>{spanish ? (account ? "La aplicación necesita atención" : "Se requiere configurar la cuenta") : (account ? "App access needs attention" : "Account setup needed")}</h1><p>{appError}</p>
    <button className="secondary" onClick={() => void signOut()}>{spanish ? "Cerrar sesión" : "Sign out"}</button>
  </div></div>;

  return (
    <main onClick={() => setAccountMenuOpen(false)}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">SC</span>
          <span><b>Steadfast &amp; Co.</b><small>Cleaning</small></span></div>
        <div className="topbar-actions">
          <div className="signed-in-language" role="group" aria-label={spanish ? "Cambiar idioma" : "Change language"}>
            <button type="button" className={!spanish ? "active" : ""} lang="en"
              aria-pressed={!spanish} onClick={() => setPreferredLanguage("en")}>EN</button>
            <button type="button" className={spanish ? "active" : ""} lang="es"
              aria-pressed={spanish} onClick={() => setPreferredLanguage("es")}>ES</button>
          </div>
          <div className="account-menu-wrap" onClick={(event) => event.stopPropagation()}>
            <button className="avatar" aria-label={`Account menu for ${account?.full_name || "signed-in user"}`}
              aria-expanded={accountMenuOpen} onClick={(event) => { event.stopPropagation(); setAccountMenuOpen((open) => !open); }}>
              {accountInitials(account)}
            </button>
            {accountMenuOpen && <div className="account-menu">
              <div className="account-menu-heading"><b>{account?.full_name}</b><span>{account?.email || session?.user.email}</span></div>
              <button onClick={() => { setEditingProfile(true); setAccountMenuOpen(false); }}>{spanish ? "Editar información personal" : "Edit personal information"}</button>
              <NotificationButton compact />
              <button className="account-signout" onClick={() => void signOut()}>{spanish ? "Cerrar sesión" : "Log out"}</button>
            </div>}
          </div>
        </div>
      </header>
      <div className="demo-bar">
        <span><i /> {isSupabaseConfigured ? `${spanish ? "¡Bienvenido" : "Welcome"} ${firstNameFor(account)}!` : (spanish ? "Modo de vista previa" : "Preview mode")}</span>
        {!isSupabaseConfigured && <>
        <div className="role-switch">
          <button className={role === "employee" ? "active" : ""} onClick={() => setRole("employee")}>Employee</button>
          <button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>Owner</button>
        </div>
        {role === "employee" && <button className="signup-preview" onClick={() => setShowRegistration(true)}>Preview registration</button>}
        </>}
      </div>
      {role === "employee" ? (showRegistration
        ? <EmployeeRegistration onComplete={completeRegistration} onCancel={() => setShowRegistration(false)} />
        : <EmployeeView blocks={shown} availableCount={available.length} tab={tab} setTab={setTab} claim={claim} />)
        : <OwnerView blocks={blocks} employees={employees} alerts={ownerAlerts}
          onCreate={() => setShowForm(true)} onEdit={setEditingBlock} onDelete={deleteBlock}
          onAssign={assignBlock} onUnassign={unassignBlock}
          onSetEmployeeActive={setEmployeeActive} onInviteEmployee={inviteEmployee} />}
      {showForm && <CreateBlock onClose={() => setShowForm(false)} onCreate={createBlock} />}
      {editingBlock && <CreateBlock key={editingBlock.id} initialBlock={editingBlock}
        onClose={() => setEditingBlock(null)} onCreate={updateBlock} />}
      {editingProfile && account && <ProfileSettings account={account} sessionEmail={session?.user.email || ""}
        onClose={() => setEditingProfile(false)} onSave={updateOwnProfile} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function ProfileSettings({ account, sessionEmail, onClose, onSave }: {
  account: AccountProfile; sessionEmail: string; onClose: () => void;
  onSave: (values: { firstName: string; lastName: string; email: string; phone: string; address: string; language: string }) => Promise<string | void>;
}) {
  const { spanish } = useAppLanguage();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    const result = await onSave({
      firstName: String(data.get("firstName")).trim(), lastName: String(data.get("lastName")).trim(),
      email: String(data.get("email")).trim(), phone: String(data.get("phone")).trim(),
      address: String(data.get("address")).trim(), language: String(data.get("language")),
    });
    if (result) setError(result);
    setSaving(false);
  }
  const nameParts = account.full_name.trim().split(/\s+/);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal profile-settings-modal">
      <button className="close" aria-label="Close profile settings" onClick={onClose}>×</button>
      <p className="eyebrow">{spanish ? "MI CUENTA" : "MY ACCOUNT"}</p><h2>{spanish ? "Información personal" : "Personal information"}</h2>
      <p className="form-intro">{spanish ? "Mantén actualizada tu información de contacto." : "Keep your contact information current."}</p>
      <form onSubmit={submit}>
        <label>{spanish ? "Nombre" : "First name"}<input name="firstName" defaultValue={account.first_name || nameParts[0] || ""} required /></label>
        <label>{spanish ? "Apellido" : "Last name"}<input name="lastName" defaultValue={account.last_name || nameParts.slice(1).join(" ")} required /></label>
        <label className="wide">{spanish ? "Correo electrónico" : "Email address"}<input name="email" type="email" defaultValue={account.email || sessionEmail} required />
          <small className="field-note">{spanish ? "Cambiar el correo puede requerir confirmación." : "Changing your email may require confirmation from your new address."}</small></label>
        <label>{spanish ? "Teléfono" : "Phone number"}<input name="phone" type="tel" autoComplete="tel" defaultValue={account.phone || ""} /></label>
        <label>{spanish ? "Idioma preferido" : "Preferred language"}<select name="language" defaultValue={account.preferred_language || "English"}>
          <option>English</option><option>Español</option>
        </select></label>
        <label className="wide">{spanish ? "Dirección" : "Home address"}<input name="address" autoComplete="street-address" defaultValue={account.address || ""} /></label>
        {error && <p className="form-error wide">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>{spanish ? "Cancelar" : "Cancel"}</button>
          <button className="primary" disabled={saving}>{saving ? (spanish ? "Guardando…" : "Saving…") : (spanish ? "Guardar cambios" : "Save changes")}</button></div>
      </form>
    </section>
  </div>;
}

function LoginScreen() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { language, setLanguage } = useAppLanguage();
  const copy = language === "es" ? {
    welcome: "Bienvenido de nuevo", intro: "Inicia sesión con la cuenta proporcionada por el propietario.",
    email: "Correo electrónico", password: "Contraseña", signIn: "Iniciar sesión", signingIn: "Iniciando sesión…",
    forgot: "¿Olvidaste tu contraseña?", recovery: "RECUPERACIÓN DE CUENTA", reset: "Restablece tu contraseña",
    resetIntro: "Ingresa tu correo de trabajo y te enviaremos un enlace seguro.", send: "Enviar enlace",
    sending: "Enviando…", back: "Volver a iniciar sesión", check: "Revisa tu correo",
    sent: "Si existe una cuenta con esa dirección, recibirás un enlace para restablecer la contraseña.",
  } : {
    welcome: "Welcome back", intro: "Sign in with the account provided by the owner.",
    email: "Email", password: "Password", signIn: "Sign in", signingIn: "Signing in…",
    forgot: "Forgot password?", recovery: "ACCOUNT RECOVERY", reset: "Reset your password",
    resetIntro: "Enter your work email and we’ll send you a secure reset link.", send: "Send reset link",
    sending: "Sending…", back: "Back to sign in", check: "Check your email",
    sent: "If an account exists for that address, a password-reset link is on its way.",
  };
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")), password: String(form.get("password")),
    });
    if (authError) setError(authError.message);
    setSubmitting(false);
  }
  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    if (resetError) setError(resetError.message);
    else setResetSent(true);
    setSubmitting(false);
  }
  return <main className="auth-shell"><section className="auth-card">
    <div className="brand"><span className="brand-mark">SC</span><span><b>Steadfast &amp; Co.</b><small>Cleaning</small></span></div>
    <div className="auth-language" aria-label="Choose language">
      <button className={language === "en" ? "active" : ""} lang="en" onClick={() => setLanguage("en")}>English</button>
      <button className={language === "es" ? "active" : ""} lang="es" onClick={() => setLanguage("es")}>Español</button>
    </div>
    {forgotMode ? <>
      <p className="eyebrow">{copy.recovery}</p><h1>{copy.reset}</h1>
      {resetSent ? <div className="auth-success"><b>{copy.check}</b><p>{copy.sent}</p></div>
        : <><p>{copy.resetIntro}</p>
          <form onSubmit={requestReset}><label>{copy.email}<input name="email" type="email" autoComplete="email" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary" disabled={submitting}>{submitting ? copy.sending : copy.send}</button>
          </form></>}
      <button className="auth-link" onClick={() => { setForgotMode(false); setResetSent(false); setError(""); }}>{copy.back}</button>
    </> : <>
      <h1>{copy.welcome}</h1>
      <p>{copy.intro}</p>
      <form onSubmit={signIn}><label>{copy.email}<input name="email" type="email" autoComplete="email" required /></label>
        <label>{copy.password}<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary" disabled={submitting}>{submitting ? copy.signingIn : copy.signIn}</button>
      </form>
      <button className="auth-link" onClick={() => { setForgotMode(true); setError(""); }}>{copy.forgot}</button>
    </>}
  </section></main>;
}

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setSubmitting(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      await supabase.auth.signOut();
      window.history.replaceState({}, "", window.location.pathname);
      onDone();
    }
    setSubmitting(false);
  }
  return <main className="auth-shell"><section className="auth-card">
    <div className="brand"><span className="brand-mark">SC</span><span><b>Steadfast &amp; Co.</b><small>Cleaning</small></span></div>
    <p className="eyebrow">ACCOUNT RECOVERY</p><h1>Choose a new password</h1>
    <p>Your new password must contain at least eight characters.</p>
    <form onSubmit={updatePassword}>
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary" disabled={submitting}>{submitting ? "Saving…" : "Save new password"}</button>
    </form>
  </section></main>;
}

function EmployeeView({ blocks, availableCount, tab, setTab, claim }: {
  blocks: WorkBlock[]; availableCount: number; tab: "available" | "mine";
  setTab: (tab: "available" | "mine") => void; claim: (id: string) => void;
}) {
  const { spanish } = useAppLanguage();
  return <section className="page">
    <div className="hero"><p className="eyebrow">{spanish ? "TRABAJO DISPONIBLE" : "AVAILABLE WORK"}</p>
      <h1>{spanish ? "Tu tablero de trabajo" : "Your work board"}</h1>
      <p>{availableCount ? (spanish ? `${availableCount} trabajos nuevos están disponibles.` : `${availableCount} new work blocks are ready to claim.`) : (spanish ? "No tienes trabajos nuevos por ahora." : "You're all caught up for now.")}</p>
      {isSupabaseConfigured && <NotificationButton />}
    </div>
    <nav className="tabs">
      <button className={tab === "available" ? "active" : ""} onClick={() => setTab("available")}>
        {spanish ? "Disponibles" : "Available"} <span>{availableCount}</span></button>
      <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>{spanish ? "Mi trabajo" : "My work"}</button>
    </nav>
    <div className="job-grid">
      {blocks.length ? blocks.map((block) => <JobCard key={block.id} block={block} onClaim={claim} />)
        : <div className="empty"><span>✓</span><h2>{spanish ? "No hay trabajos aquí" : "No blocks here"}</h2>
          <p>{spanish ? "Te avisaremos cuando se publique trabajo nuevo." : "We’ll notify you as soon as new work is posted."}</p></div>}
    </div>
  </section>;
}

function JobCard({ block, onClaim }: { block: WorkBlock; onClaim: (id: string) => void }) {
  const { spanish } = useAppLanguage();
  const claimed = block.status !== "open";
  return <article className="job-card">
    <div className="job-top"><div><span className="status-pill">{claimed ? (spanish ? "TU TRABAJO" : "YOUR WORK") : (spanish ? "DISPONIBLE" : "AVAILABLE")}</span>
      <h2>{block.title}</h2></div><strong className="pay">${block.pay}<small> {spanish ? "total" : "total"}</small></strong></div>
    <div className="facts">
      <p><span>▣</span><b>{day(block.date)}</b>
        <small>{spanish ? "Llegada más temprana" : "Soonest arrival"}: {time(block.startTime)}<br />{spanish ? "Salida más tarde" : "Latest departure"}: {time(block.endTime)}</small></p>
      <p><span>⌖</span><b>{claimed ? block.address : `${block.city}, AZ ${block.zip}`}</b>
        <small>{claimed ? (spanish ? "Dirección completa disponible" : "Full address unlocked") : (spanish ? "Dirección exacta después de aceptar" : "Exact address after acceptance")}</small></p>
    </div>
    <div className="occupancy">
      <span>□ {block.squareFeet.toLocaleString()} {spanish ? "pies²" : "sq ft"}</span>
      <span>{block.occupancy === "vacant" ? (spanish ? "⌂ Casa vacía" : "⌂ Vacant home") : (spanish ? "⌂ Casa ocupada" : "⌂ Occupied home")}</span>
      {block.occupancy === "occupied" &&
        <span>{block.ownersPresent ? (spanish ? "Los propietarios estarán presentes" : "Owners will be present") : (spanish ? "Los propietarios no estarán presentes" : "Owners will not be present")}</span>}
    </div>
    <div className="task-list">{block.details.map((detail) => <span key={detail}>✓ {detail}</span>)}</div>
    {claimed && <div className="private-details">
      <b>{spanish ? "Acceso a la propiedad" : "Property access"}</b><p>{block.accessCodes || (spanish ? "No se proporcionó código de acceso." : "No gate or keypad code provided.")}</p>
      {block.notes && <><b>{spanish ? "Notas privadas" : "Private notes"}</b><p>{block.notes}</p></>}
    </div>}
    {!claimed && <button className="primary" onClick={() => onClaim(block.id)}>{spanish ? "Aceptar trabajo" : "Accept work block"}</button>}
  </article>;
}

function OwnerView({ blocks, employees, alerts, onCreate, onEdit, onDelete, onAssign, onUnassign, onSetEmployeeActive, onInviteEmployee }: {
  blocks: WorkBlock[]; employees: EmployeeProfile[]; alerts: string[];
  onCreate: () => void; onEdit: (block: WorkBlock) => void; onDelete: (id: string) => void;
  onAssign: (id: string, employeeId: string) => void; onUnassign: (id: string) => void;
  onSetEmployeeActive: (id: string, active: boolean) => void;
  onInviteEmployee: (firstName: string, lastName: string, email: string) => Promise<string | void>;
}) {
  const [section, setSection] = useState<"work" | "employees">("work");
  const { spanish } = useAppLanguage();
  return <section className="page">
    <nav className="owner-nav">
      <button className={section === "work" ? "active" : ""} onClick={() => setSection("work")}>{spanish ? "Tablero" : "Work board"}</button>
      <button className={section === "employees" ? "active" : ""} onClick={() => setSection("employees")}>
        {spanish ? "Empleados" : "Employees"} <span>{employees.length}</span></button>
      {section === "work" && <button className="post-work-tab" onClick={onCreate}>
        ＋ {spanish ? "Publicar trabajo" : "Post new work"}</button>}
    </nav>
    {section === "employees"
      ? <EmployeeDirectory employees={employees} onSetActive={onSetEmployeeActive} onInvite={onInviteEmployee} />
      : <OwnerWorkBoard blocks={blocks} employees={employees} alerts={alerts} onEdit={onEdit}
          onDelete={onDelete} onAssign={onAssign} onUnassign={onUnassign} />}
  </section>;
}

function OwnerCalendar({ blocks }: { blocks: WorkBlock[] }) {
  const { spanish } = useAppLanguage();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    return dayNumber >= 1 && dayNumber <= daysInMonth ? dayNumber : null;
  });
  const monthLabel = new Intl.DateTimeFormat(spanish ? "es-US" : "en-US", {
    month: "long", year: "numeric",
  }).format(visibleMonth);
  const weekdayLabels = spanish
    ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const blocksByDay = useMemo(() => {
    const result = new Map<number, WorkBlock[]>();
    blocks.forEach((block) => {
      const date = new Date(`${block.date}T12:00:00`);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const dateBlocks = result.get(date.getDate()) || [];
      dateBlocks.push(block);
      result.set(date.getDate(), dateBlocks);
    });
    return result;
  }, [blocks, month, year]);
  const moveMonth = (offset: number) => setVisibleMonth(new Date(year, month + offset, 1));

  return <section className="owner-calendar" aria-label={spanish ? "Calendario de trabajos" : "Work calendar"}>
    <div className="calendar-heading">
      <div><h2>{spanish ? "Calendario de trabajos" : "Work calendar"}</h2>
        <div className="calendar-legend">
          <span><i className="calendar-open" />{spanish ? "Esperando aceptación" : "Waiting for acceptance"}</span>
          <span><i className="calendar-claimed" />{spanish ? "Aceptado" : "Accepted"}</span>
        </div>
      </div>
      <div className="calendar-controls">
        <button type="button" aria-label={spanish ? "Mes anterior" : "Previous month"} onClick={() => moveMonth(-1)}>‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label={spanish ? "Mes siguiente" : "Next month"} onClick={() => moveMonth(1)}>›</button>
      </div>
    </div>
    <div className="calendar-scroll">
      <div className="calendar-grid">
        {weekdayLabels.map((label) => <div className="calendar-weekday" key={label}>{label}</div>)}
        {calendarDays.map((dayNumber, index) => <div className={`calendar-day${dayNumber ? "" : " calendar-day-empty"}`} key={index}>
          {dayNumber && <><span className="calendar-date">{dayNumber}</span>
            <div className="calendar-jobs">{(blocksByDay.get(dayNumber) || []).map((block) =>
              <div className={`calendar-job ${block.status === "open" ? "open" : "claimed"}`} key={block.id}
                title={`${block.title} · ${time(block.startTime)} · ${block.city}`}>
                <b>{block.title}</b><small>{time(block.startTime)} · {block.city}</small>
              </div>)}</div></>}
        </div>)}
      </div>
    </div>
  </section>;
}

function OwnerWorkBoard({ blocks, employees, alerts, onEdit, onDelete, onAssign, onUnassign }: {
  blocks: WorkBlock[]; employees: EmployeeProfile[]; alerts: string[];
  onEdit: (block: WorkBlock) => void; onDelete: (id: string) => void;
  onAssign: (id: string, employeeId: string) => void; onUnassign: (id: string) => void;
}) {
  const { spanish } = useAppLanguage();
  const counts = useMemo(() => ({
    open: blocks.filter((b) => b.status === "open").length,
    claimed: blocks.filter((b) => b.status === "claimed").length,
    payroll: blocks.filter((b) => b.status === "claimed").reduce((sum, b) => sum + b.pay, 0),
  }), [blocks]);
  return <>
    <div className="owner-heading"><div><p className="eyebrow">{spanish ? "PANEL DEL PROPIETARIO" : "OWNER DASHBOARD"}</p><h1>{spanish ? "Tablero de trabajo" : "Work board"}</h1>
      <p>{spanish ? "Publica trabajo y revisa quién lo aceptó." : "Post work and see who claimed it."}</p></div></div>
    <div className="metrics">
      <div><span>{spanish ? "Trabajos abiertos" : "Open blocks"}</span><strong>{counts.open}</strong><small>{spanish ? "Esperando empleado" : "Waiting for a cleaner"}</small></div>
      <div><span>{spanish ? "Asignados" : "Assigned"}</span><strong>{counts.claimed}</strong><small>{spanish ? "Aceptados por empleados" : "Claimed by employees"}</small></div>
      <div><span>{spanish ? "Pago próximo" : "Upcoming pay"}</span><strong>${counts.payroll}</strong><small>{spanish ? "Trabajos asignados" : "Assigned blocks"}</small></div>
    </div>
    <OwnerCalendar blocks={blocks} />
    {alerts.length > 0 && <div className="owner-alerts">
      <div><span>✓</span><strong>{spanish ? "Nueva aceptación" : "New acceptance"}</strong></div>
      <p>{alerts[0]}</p><small>Owner email recipient: raarentalsllc@gmail.com</small>
    </div>}
    <div className="owner-list"><div className="list-head"><h2>{spanish ? "Todos los trabajos" : "All work blocks"}</h2><span>{blocks.length} {spanish ? "en total" : "total"}</span></div>
      {blocks.map((block) => <article className="owner-row" key={block.id}>
        <div className="date-box"><b>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { day: "2-digit" })}</b>
          <span>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { month: "short" })}</span></div>
        <div className="row-main"><b>{block.title}</b>
          <span>Arrival {time(block.startTime)} · Departure {time(block.endTime)} · {block.city}, AZ {block.zip}</span>
          <small>{block.squareFeet.toLocaleString()} sq ft · {block.occupancy === "vacant" ? "Vacant" : `Occupied · Owners ${block.ownersPresent ? "present" : "not present"}`}</small>
        </div>
        <div className="assignee"><span className={`dot ${block.status}`} />{block.claimedBy || "Open to team"}</div>
        <strong className="row-pay">${block.pay}</strong>
        <div className="row-actions">
          {!block.claimedBy && <AssignEmployee blockId={block.id} employees={employees} onAssign={onAssign} />}
          {block.claimedBy && <button className="unassign" onClick={() => onUnassign(block.id)}>{spanish ? "Desasignar" : "Unassign"}</button>}
          <button className="row-edit" onClick={() => onEdit(block)}>{spanish ? "Editar" : "Edit"}</button>
          <button className="row-delete" onClick={() => onDelete(block.id)}>{spanish ? "Eliminar" : "Delete"}</button>
        </div>
      </article>)}
    </div>
  </>;
}

function AssignEmployee({ blockId, employees, onAssign }: {
  blockId: string; employees: EmployeeProfile[]; onAssign: (id: string, employeeId: string) => void;
}) {
  const activeEmployees = employees.filter((employee) => employee.active);
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || "");
  if (!activeEmployees.length) return <small>No active employees</small>;
  return <span className="assign-control">
    <select aria-label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
      {activeEmployees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}
    </select>
    <button onClick={() => onAssign(blockId, employeeId)}>Assign</button>
  </span>;
}

function CreateBlock({ onClose, onCreate, initialBlock }: {
  onClose: () => void; onCreate: (block: WorkBlock) => void; initialBlock?: WorkBlock;
}) {
  const initialType = initialBlock && jobTemplates[initialBlock.title] ? initialBlock.title : initialBlock ? "Custom Job" : "Airbnb Cleaning";
  const [jobType, setJobType] = useState(initialType);
  const [tasks, setTasks] = useState(initialBlock?.details.join("\n") || jobTemplates["Airbnb Cleaning"].join("\n"));
  const [occupancy, setOccupancy] = useState<"vacant" | "occupied">(initialBlock?.occupancy || "vacant");
  const [preview, setPreview] = useState({
    date: initialBlock?.date || "", start: initialBlock?.startTime || "", end: initialBlock?.endTime || "",
    city: initialBlock?.city || "", zip: initialBlock?.zip || "",
    squareFeet: String(initialBlock?.squareFeet || ""), pay: String(initialBlock?.pay || ""),
  });
  const [formError, setFormError] = useState("");

  function selectTemplate(value: string) {
    setJobType(value);
    setTasks(jobTemplates[value].join("\n"));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (String(data.get("endTime")) <= String(data.get("startTime"))) {
      setFormError("End time must be later than the start time.");
      return;
    }
    setFormError("");
    const title = jobType === "Custom Job" ? String(data.get("customTitle")) : jobType;
    onCreate({ id: initialBlock?.id || createId(), title, date: String(data.get("date")),
      startTime: String(data.get("startTime")), endTime: String(data.get("endTime")),
      city: String(data.get("city")), zip: String(data.get("zip")),
      squareFeet: Number(data.get("squareFeet")), address: String(data.get("address")),
      accessCodes: String(data.get("accessCodes")), pay: Number(data.get("pay")),
      details: String(data.get("details")).split("\n").map((item) => item.trim()).filter(Boolean),
      notes: String(data.get("notes")), occupancy,
      ownersPresent: occupancy === "occupied" ? data.get("ownersPresent") === "yes" : undefined,
      status: initialBlock?.status || "open", claimedBy: initialBlock?.claimedBy });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>
      <p className="eyebrow">{initialBlock ? "EDIT WORK BLOCK" : "NEW WORK BLOCK"}</p>
      <h2>{initialBlock ? "Update work details" : "Post work to your team"}</h2>
      <p className="form-intro">Choose a template, confirm the details, and {initialBlock ? "save your changes" : "post it to the team"}.</p>
      <form onSubmit={submit} onChange={(event) => {
        const form = event.currentTarget;
        const data = new FormData(form);
        setPreview({ date: String(data.get("date")), start: String(data.get("startTime")),
          end: String(data.get("endTime")), city: String(data.get("city")),
          zip: String(data.get("zip")), squareFeet: String(data.get("squareFeet")),
          pay: String(data.get("pay")) });
      }}>
        <label className="wide">Job type
          <select name="jobType" value={jobType} onChange={(event) => selectTemplate(event.target.value)}>
            {Object.keys(jobTemplates).map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        {jobType === "Custom Job" && <label className="wide">Custom job name
          <input name="customTitle" required defaultValue={initialType === "Custom Job" ? initialBlock?.title : ""} placeholder="Enter the job type" /></label>}
        <label>Date<input name="date" type="date" required defaultValue={initialBlock?.date} /></label>
        <label>Employee pay ($)<input name="pay" type="number" min="1" required defaultValue={initialBlock?.pay} placeholder="110" /></label>
        <label>Soonest arrival time<input name="startTime" type="time" required defaultValue={initialBlock?.startTime} /></label>
        <label>Latest departure time<input name="endTime" type="time" required defaultValue={initialBlock?.endTime} /></label>
        <label>City<input name="city" required defaultValue={initialBlock?.city} placeholder="Scottsdale" /></label>
        <label>ZIP code<input name="zip" required defaultValue={initialBlock?.zip} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="85254" /></label>
        <label className="wide">Home square footage
          <input name="squareFeet" type="number" min="1" required defaultValue={initialBlock?.squareFeet} placeholder="1850" />
          <small className="field-note">Shown to employees before they accept.</small>
        </label>
        <label>Home status
          <select name="occupancy" value={occupancy} onChange={(event) => setOccupancy(event.target.value as "vacant" | "occupied")}>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </select>
        </label>
        {occupancy === "occupied" && <label>Will owners be present?
          <select name="ownersPresent" defaultValue={initialBlock?.ownersPresent === false ? "no" : "yes"}>
            <option value="yes">Yes, owners present</option>
            <option value="no">No, owners not present</option>
          </select>
        </label>}
        <label className="wide">Full street address
          <input name="address" required defaultValue={initialBlock?.address} placeholder="Hidden until an employee accepts" />
          <small className="field-note">Only the assigned employee will see this address.</small>
        </label>
        <label className="wide">Gate and door access codes
          <textarea name="accessCodes" rows={2} defaultValue={initialBlock?.accessCodes} placeholder="Gate: #2468 · Front door keypad: 1937" />
          <small className="field-note">Private—shown only after an employee accepts.</small>
        </label>
        <label className="wide">Cleaning checklist
          <textarea name="details" required rows={5} value={tasks} onChange={(event) => setTasks(event.target.value)} />
          <small className="field-note">One task per line. Templates can be adjusted for each job.</small>
        </label>
        <label className="wide">Private job notes<textarea name="notes" rows={2} defaultValue={initialBlock?.notes} placeholder="Entry instructions, pets, supplies…" /></label>
        <div className="job-preview wide">
          <span>EMPLOYEE PREVIEW</span><b>{jobType}</b>
          <p>{preview.city || "City"}, AZ {preview.zip || "ZIP"} · {preview.date ? day(preview.date) : "Date"}</p>
          <p>Soonest arrival: {preview.start ? time(preview.start) : "—"}<br />
            Latest departure: {preview.end ? time(preview.end) : "—"} · <strong>${preview.pay || "0"} pay</strong></p>
          <p>{preview.squareFeet ? Number(preview.squareFeet).toLocaleString() : "—"} sq ft · {occupancy === "vacant" ? "Vacant home" : "Occupied home"}</p>
          <small>Full address remains hidden until acceptance.</small>
        </div>
        {formError && <p className="form-error wide">{formError}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary">{initialBlock ? "Save changes" : "Post work block"}</button></div>
      </form>
    </div>
  </div>;
}
