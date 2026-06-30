"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmployeeDirectory } from "@/components/employee-directory";
import { EmployeeRegistration, type EmployeeProfile } from "@/components/employee-registration";

type Role = "owner" | "employee";
type Status = "open" | "claimed" | "completed";
type WorkBlock = {
  id: string; title: string; date: string; startTime: string; endTime: string;
  city: string; zip: string; squareFeet: number; address: string; accessCodes: string;
  pay: number; details: string[]; notes: string;
  occupancy: "vacant" | "occupied"; ownersPresent?: boolean;
  status: Status; claimedBy?: string;
};

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
    email: "maria@example.com", phone: "(602) 555-0142", paymentMethod: "Zelle",
    paymentContact: "(602) 555-0142", serviceArea: "Scottsdale, Paradise Valley",
    emergencyContact: "Elena Rodriguez · (602) 555-0199", joinedAt: "2025-10-12T12:00:00Z", active: true,
    standing: "good", score: 94, standingNote: "Strong attendance and consistently positive feedback.",
    completedJobs: 48, attendanceRate: 98, paidMonth: 720, paidYear: 6840, paidLifetime: 9320 },
  { id: "employee-jasmine", language: "English", firstName: "Jasmine", lastName: "Lee",
    name: "Jasmine Lee", dateOfBirth: "1996-09-03",
    email: "jasmine@example.com", phone: "(480) 555-0168", paymentMethod: "ACH",
    paymentContact: "Secure payout account connected", serviceArea: "Phoenix, Tempe",
    emergencyContact: "", joinedAt: "2026-01-08T12:00:00Z", active: false, standing: "watch", score: 72,
    standingNote: "Two recent late arrivals; owner follow-up recommended.",
    completedJobs: 21, attendanceRate: 86, paidMonth: 450, paidYear: 3380, paidLifetime: 3380 },
  { id: "employee-sofia", language: "Español", firstName: "Sofia", lastName: "Martinez",
    name: "Sofia Martinez", dateOfBirth: "1989-12-11",
    email: "sofia@example.com", phone: "(623) 555-0115", paymentMethod: "Zelle",
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

export default function Home() {
  const [role, setRole] = useState<Role>("employee");
  const [blocks, setBlocks] = useState<WorkBlock[]>(seedBlocks);
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const [ownerAlerts, setOwnerAlerts] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>(seedEmployees);
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dhc-demo-blocks");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<WorkBlock & { duration?: number; area?: string }>;
      const compatible = parsed.every((block) =>
        block.endTime && block.city && block.zip && block.occupancy && block.squareFeet);
      if (compatible) queueMicrotask(() => setBlocks(parsed));
    }
  }, []);
  useEffect(() => { localStorage.setItem("dhc-demo-blocks", JSON.stringify(blocks)); }, [blocks]);
  useEffect(() => {
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
  useEffect(() => { localStorage.setItem("dhc-demo-employees", JSON.stringify(employees)); }, [employees]);

  const available = blocks.filter((block) => block.status === "open");
  const mine = blocks.filter((block) => block.claimedBy === "Maria");
  const shown = tab === "available" ? available : mine;

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }
  function claim(id: string) {
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
  function createBlock(block: WorkBlock) {
    setBlocks((current) => [block, ...current]);
    setShowForm(false);
    notify("Work block posted to the team.");
  }
  function unassignBlock(id: string) {
    const block = blocks.find((item) => item.id === id);
    if (!block?.claimedBy) return;
    if (!window.confirm(`Remove ${block.claimedBy} from this job and make it available again?`)) return;
    setBlocks((current) => current.map((item) =>
      item.id === id ? { ...item, status: "open", claimedBy: undefined } : item));
    notify("Assignment removed. The work block is available again.");
  }
  function completeRegistration(employee: EmployeeProfile) {
    setEmployees((current) => [employee, ...current]);
    localStorage.setItem("dhc-demo-onboarded", "true");
    setShowRegistration(false);
    notify("Registration complete. Welcome to the team!");
  }
  function setEmployeeActive(id: string, active: boolean) {
    setEmployees((current) => current.map((employee) =>
      employee.id === id ? { ...employee, active } : employee));
    notify(active ? "Employee account reactivated." : "Employee account deactivated.");
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">D</span>
          <span><b>Desert Home</b><small>Cleaning team</small></span></div>
        <button className="avatar" aria-label="Open account menu">{role === "owner" ? "JD" : "MR"}</button>
      </header>
      <div className="demo-bar">
        <span><i /> Preview mode</span>
        <div className="role-switch">
          <button className={role === "employee" ? "active" : ""} onClick={() => setRole("employee")}>Employee</button>
          <button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>Owner</button>
        </div>
        {role === "employee" && <button className="signup-preview" onClick={() => setShowRegistration(true)}>Preview registration</button>}
      </div>
      {role === "employee" ? (showRegistration
        ? <EmployeeRegistration onComplete={completeRegistration} onCancel={() => setShowRegistration(false)} />
        : <EmployeeView blocks={shown} availableCount={available.length} tab={tab} setTab={setTab} claim={claim} />)
        : <OwnerView blocks={blocks} employees={employees} alerts={ownerAlerts}
          onCreate={() => setShowForm(true)} onUnassign={unassignBlock}
          onSetEmployeeActive={setEmployeeActive} />}
      {showForm && <CreateBlock onClose={() => setShowForm(false)} onCreate={createBlock} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function EmployeeView({ blocks, availableCount, tab, setTab, claim }: {
  blocks: WorkBlock[]; availableCount: number; tab: "available" | "mine";
  setTab: (tab: "available" | "mine") => void; claim: (id: string) => void;
}) {
  return <section className="page">
    <div className="hero"><p className="eyebrow">MONDAY, JUNE 29</p>
      <h1>Good afternoon, Maria.</h1>
      <p>{availableCount ? `${availableCount} new work blocks are ready to claim.` : "You're all caught up for now."}</p>
    </div>
    <nav className="tabs">
      <button className={tab === "available" ? "active" : ""} onClick={() => setTab("available")}>
        Available <span>{availableCount}</span></button>
      <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>My work</button>
    </nav>
    <div className="job-grid">
      {blocks.length ? blocks.map((block) => <JobCard key={block.id} block={block} onClaim={claim} />)
        : <div className="empty"><span>✓</span><h2>No blocks here</h2>
          <p>We’ll notify you as soon as new work is posted.</p></div>}
    </div>
  </section>;
}

function JobCard({ block, onClaim }: { block: WorkBlock; onClaim: (id: string) => void }) {
  const claimed = block.status !== "open";
  return <article className="job-card">
    <div className="job-top"><div><span className="status-pill">{claimed ? "YOUR WORK" : "AVAILABLE"}</span>
      <h2>{block.title}</h2></div><strong className="pay">${block.pay}<small> total</small></strong></div>
    <div className="facts">
      <p><span>▣</span><b>{day(block.date)}</b>
        <small>Soonest arrival: {time(block.startTime)}<br />Latest departure: {time(block.endTime)}</small></p>
      <p><span>⌖</span><b>{claimed ? block.address : `${block.city}, AZ ${block.zip}`}</b>
        <small>{claimed ? "Full address unlocked" : "Exact address after acceptance"}</small></p>
    </div>
    <div className="occupancy">
      <span>□ {block.squareFeet.toLocaleString()} sq ft</span>
      <span>{block.occupancy === "vacant" ? "⌂ Vacant home" : "⌂ Occupied home"}</span>
      {block.occupancy === "occupied" &&
        <span>{block.ownersPresent ? "Owners will be present" : "Owners will not be present"}</span>}
    </div>
    <div className="task-list">{block.details.map((detail) => <span key={detail}>✓ {detail}</span>)}</div>
    {claimed && <div className="private-details">
      <b>Property access</b><p>{block.accessCodes || "No gate or keypad code provided."}</p>
      {block.notes && <><b>Private notes</b><p>{block.notes}</p></>}
    </div>}
    {!claimed && <button className="primary" onClick={() => onClaim(block.id)}>Accept work block</button>}
  </article>;
}

function OwnerView({ blocks, employees, alerts, onCreate, onUnassign, onSetEmployeeActive }: {
  blocks: WorkBlock[]; employees: EmployeeProfile[]; alerts: string[];
  onCreate: () => void; onUnassign: (id: string) => void;
  onSetEmployeeActive: (id: string, active: boolean) => void;
}) {
  const [section, setSection] = useState<"work" | "employees">("work");
  return <section className="page">
    <nav className="owner-nav">
      <button className={section === "work" ? "active" : ""} onClick={() => setSection("work")}>Work board</button>
      <button className={section === "employees" ? "active" : ""} onClick={() => setSection("employees")}>
        Employees <span>{employees.length}</span></button>
    </nav>
    {section === "employees"
      ? <EmployeeDirectory employees={employees} onSetActive={onSetEmployeeActive} />
      : <OwnerWorkBoard blocks={blocks} alerts={alerts} onCreate={onCreate} onUnassign={onUnassign} />}
  </section>;
}

function OwnerWorkBoard({ blocks, alerts, onCreate, onUnassign }: {
  blocks: WorkBlock[]; alerts: string[]; onCreate: () => void; onUnassign: (id: string) => void;
}) {
  const counts = useMemo(() => ({
    open: blocks.filter((b) => b.status === "open").length,
    claimed: blocks.filter((b) => b.status === "claimed").length,
    payroll: blocks.filter((b) => b.status === "claimed").reduce((sum, b) => sum + b.pay, 0),
  }), [blocks]);
  return <>
    <div className="owner-heading"><div><p className="eyebrow">OWNER DASHBOARD</p><h1>Work board</h1>
      <p>Post work and see who claimed it.</p></div>
      <button className="primary compact" onClick={onCreate}>＋ Post new work</button></div>
    <div className="metrics">
      <div><span>Open blocks</span><strong>{counts.open}</strong><small>Waiting for a cleaner</small></div>
      <div><span>Assigned</span><strong>{counts.claimed}</strong><small>Claimed by employees</small></div>
      <div><span>Upcoming pay</span><strong>${counts.payroll}</strong><small>Assigned blocks</small></div>
    </div>
    {alerts.length > 0 && <div className="owner-alerts">
      <div><span>✓</span><strong>New acceptance</strong></div>
      <p>{alerts[0]}</p><small>Owner email recipient: raarentalsllc@gmail.com</small>
    </div>}
    <div className="owner-list"><div className="list-head"><h2>All work blocks</h2><span>{blocks.length} total</span></div>
      {blocks.map((block) => <article className="owner-row" key={block.id}>
        <div className="date-box"><b>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { day: "2-digit" })}</b>
          <span>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { month: "short" })}</span></div>
        <div className="row-main"><b>{block.title}</b>
          <span>Arrival {time(block.startTime)} · Departure {time(block.endTime)} · {block.city}, AZ {block.zip}</span>
          <small>{block.squareFeet.toLocaleString()} sq ft · {block.occupancy === "vacant" ? "Vacant" : `Occupied · Owners ${block.ownersPresent ? "present" : "not present"}`}</small>
        </div>
        <div className="assignee"><span className={`dot ${block.status}`} />{block.claimedBy || "Open to team"}</div>
        <strong className="row-pay">${block.pay}</strong>
        <div className="row-actions">{block.claimedBy
          ? <button className="unassign" onClick={() => onUnassign(block.id)}>Remove assignment</button>
          : <span>—</span>}
        </div>
      </article>)}
    </div>
  </>;
}

function CreateBlock({ onClose, onCreate }: { onClose: () => void; onCreate: (block: WorkBlock) => void }) {
  const [jobType, setJobType] = useState("Airbnb Cleaning");
  const [tasks, setTasks] = useState(jobTemplates["Airbnb Cleaning"].join("\n"));
  const [occupancy, setOccupancy] = useState<"vacant" | "occupied">("vacant");
  const [preview, setPreview] = useState({
    date: "", start: "", end: "", city: "", zip: "", squareFeet: "", pay: "",
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
    onCreate({ id: crypto.randomUUID(), title, date: String(data.get("date")),
      startTime: String(data.get("startTime")), endTime: String(data.get("endTime")),
      city: String(data.get("city")), zip: String(data.get("zip")),
      squareFeet: Number(data.get("squareFeet")), address: String(data.get("address")),
      accessCodes: String(data.get("accessCodes")), pay: Number(data.get("pay")),
      details: String(data.get("details")).split("\n").map((item) => item.trim()).filter(Boolean),
      notes: String(data.get("notes")), occupancy,
      ownersPresent: occupancy === "occupied" ? data.get("ownersPresent") === "yes" : undefined,
      status: "open" });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>
      <p className="eyebrow">NEW WORK BLOCK</p><h2>Post work to your team</h2>
      <p className="form-intro">Choose a template, confirm the details, and post it to the team.</p>
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
          <input name="customTitle" required placeholder="Enter the job type" /></label>}
        <label>Date<input name="date" type="date" required /></label>
        <label>Employee pay ($)<input name="pay" type="number" min="1" required placeholder="110" /></label>
        <label>Soonest arrival time<input name="startTime" type="time" required /></label>
        <label>Latest departure time<input name="endTime" type="time" required /></label>
        <label>City<input name="city" required placeholder="Scottsdale" /></label>
        <label>ZIP code<input name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="85254" /></label>
        <label className="wide">Home square footage
          <input name="squareFeet" type="number" min="1" required placeholder="1850" />
          <small className="field-note">Shown to employees before they accept.</small>
        </label>
        <label>Home status
          <select name="occupancy" value={occupancy} onChange={(event) => setOccupancy(event.target.value as "vacant" | "occupied")}>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </select>
        </label>
        {occupancy === "occupied" && <label>Will owners be present?
          <select name="ownersPresent" defaultValue="yes">
            <option value="yes">Yes, owners present</option>
            <option value="no">No, owners not present</option>
          </select>
        </label>}
        <label className="wide">Full street address
          <input name="address" required placeholder="Hidden until an employee accepts" />
          <small className="field-note">Only the assigned employee will see this address.</small>
        </label>
        <label className="wide">Gate and door access codes
          <textarea name="accessCodes" rows={2} placeholder="Gate: #2468 · Front door keypad: 1937" />
          <small className="field-note">Private—shown only after an employee accepts.</small>
        </label>
        <label className="wide">Cleaning checklist
          <textarea name="details" required rows={5} value={tasks} onChange={(event) => setTasks(event.target.value)} />
          <small className="field-note">One task per line. Templates can be adjusted for each job.</small>
        </label>
        <label className="wide">Private job notes<textarea name="notes" rows={2} placeholder="Entry instructions, pets, supplies…" /></label>
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
          <button className="primary">Post work block</button></div>
      </form>
    </div>
  </div>;
}
