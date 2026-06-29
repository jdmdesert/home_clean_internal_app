"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "owner" | "employee";
type Status = "open" | "claimed" | "completed";
type WorkBlock = {
  id: string; title: string; date: string; startTime: string; endTime: string;
  city: string; zip: string; address: string; pay: number; details: string[]; notes: string;
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
    details: ["3 bed / 2 bath", "Inside oven", "Inside cabinets"],
    notes: "Home is vacant. Lockbox details appear after acceptance.", status: "open" },
  { id: "seed-2", title: "Airbnb Cleaning", date: "2026-07-03", startTime: "13:30", endTime: "16:30",
    city: "Paradise Valley", zip: "85253", address: "5114 N. Mockingbird Ln, Paradise Valley, AZ 85253", pay: 90,
    details: ["2 bed / 2 bath", "Standard clean", "Pet-friendly products"],
    notes: "One friendly dog will be home.", status: "open" },
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

  useEffect(() => {
    const saved = localStorage.getItem("dhc-demo-blocks");
    if (saved) {
      const parsed = JSON.parse(saved) as Array<WorkBlock & { duration?: number; area?: string }>;
      const compatible = parsed.every((block) => block.endTime && block.city && block.zip);
      if (compatible) queueMicrotask(() => setBlocks(parsed));
    }
  }, []);
  useEffect(() => { localStorage.setItem("dhc-demo-blocks", JSON.stringify(blocks)); }, [blocks]);

  const available = blocks.filter((block) => block.status === "open");
  const mine = blocks.filter((block) => block.claimedBy === "Maria");
  const shown = tab === "available" ? available : mine;

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }
  function claim(id: string) {
    setBlocks((current) => current.map((block) =>
      block.id === id && block.status === "open"
        ? { ...block, status: "claimed", claimedBy: "Maria" } : block));
    notify("You got it! The address is now unlocked.");
    setTab("mine");
  }
  function createBlock(block: WorkBlock) {
    setBlocks((current) => [block, ...current]);
    setShowForm(false);
    notify("Work block posted to the team.");
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
      </div>
      {role === "employee"
        ? <EmployeeView blocks={shown} availableCount={available.length} tab={tab} setTab={setTab} claim={claim} />
        : <OwnerView blocks={blocks} onCreate={() => setShowForm(true)} />}
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
      <p><span>▣</span><b>{day(block.date)}</b><small>{time(block.startTime)}–{time(block.endTime)}</small></p>
      <p><span>⌖</span><b>{claimed ? block.address : `${block.city}, AZ ${block.zip}`}</b>
        <small>{claimed ? "Full address unlocked" : "Exact address after acceptance"}</small></p>
    </div>
    <div className="task-list">{block.details.map((detail) => <span key={detail}>✓ {detail}</span>)}</div>
    {claimed && <p className="notes">{block.notes}</p>}
    {!claimed && <button className="primary" onClick={() => onClaim(block.id)}>Accept work block</button>}
  </article>;
}

function OwnerView({ blocks, onCreate }: { blocks: WorkBlock[]; onCreate: () => void }) {
  const counts = useMemo(() => ({
    open: blocks.filter((b) => b.status === "open").length,
    claimed: blocks.filter((b) => b.status === "claimed").length,
    payroll: blocks.filter((b) => b.status === "claimed").reduce((sum, b) => sum + b.pay, 0),
  }), [blocks]);
  return <section className="page">
    <div className="owner-heading"><div><p className="eyebrow">OWNER DASHBOARD</p><h1>Work board</h1>
      <p>Post work and see who claimed it.</p></div>
      <button className="primary compact" onClick={onCreate}>＋ Post new work</button></div>
    <div className="metrics">
      <div><span>Open blocks</span><strong>{counts.open}</strong><small>Waiting for a cleaner</small></div>
      <div><span>Assigned</span><strong>{counts.claimed}</strong><small>Claimed by employees</small></div>
      <div><span>Upcoming pay</span><strong>${counts.payroll}</strong><small>Assigned blocks</small></div>
    </div>
    <div className="owner-list"><div className="list-head"><h2>All work blocks</h2><span>{blocks.length} total</span></div>
      {blocks.map((block) => <article className="owner-row" key={block.id}>
        <div className="date-box"><b>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { day: "2-digit" })}</b>
          <span>{new Date(`${block.date}T12:00`).toLocaleDateString("en-US", { month: "short" })}</span></div>
        <div className="row-main"><b>{block.title}</b><span>{time(block.startTime)}–{time(block.endTime)} · {block.city}, AZ {block.zip}</span></div>
        <div className="assignee"><span className={`dot ${block.status}`} />{block.claimedBy || "Open to team"}</div>
        <strong className="row-pay">${block.pay}</strong>
      </article>)}
    </div>
  </section>;
}

function CreateBlock({ onClose, onCreate }: { onClose: () => void; onCreate: (block: WorkBlock) => void }) {
  const [jobType, setJobType] = useState("Airbnb Cleaning");
  const [tasks, setTasks] = useState(jobTemplates["Airbnb Cleaning"].join("\n"));
  const [preview, setPreview] = useState({ date: "", start: "", end: "", city: "", zip: "", pay: "" });
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
      address: String(data.get("address")), pay: Number(data.get("pay")),
      details: String(data.get("details")).split("\n").map((item) => item.trim()).filter(Boolean),
      notes: String(data.get("notes")), status: "open" });
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
          zip: String(data.get("zip")), pay: String(data.get("pay")) });
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
        <label>Start time<input name="startTime" type="time" required /></label>
        <label>End time<input name="endTime" type="time" required /></label>
        <label>City<input name="city" required placeholder="Scottsdale" /></label>
        <label>ZIP code<input name="zip" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="85254" /></label>
        <label className="wide">Full street address
          <input name="address" required placeholder="Hidden until an employee accepts" />
          <small className="field-note">Only the assigned employee will see this address.</small>
        </label>
        <label className="wide">Cleaning checklist
          <textarea name="details" required rows={5} value={tasks} onChange={(event) => setTasks(event.target.value)} />
          <small className="field-note">One task per line. Templates can be adjusted for each job.</small>
        </label>
        <label className="wide">Private job notes<textarea name="notes" rows={2} placeholder="Entry instructions, pets, supplies…" /></label>
        <div className="job-preview wide">
          <span>EMPLOYEE PREVIEW</span><b>{jobType}</b>
          <p>{preview.city || "City"}, AZ {preview.zip || "ZIP"} · {preview.date ? day(preview.date) : "Date"}</p>
          <p>{preview.start ? time(preview.start) : "Start"}–{preview.end ? time(preview.end) : "End"} · <strong>${preview.pay || "0"} pay</strong></p>
          <small>Full address remains hidden until acceptance.</small>
        </div>
        {formError && <p className="form-error wide">{formError}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary">Post work block</button></div>
      </form>
    </div>
  </div>;
}
