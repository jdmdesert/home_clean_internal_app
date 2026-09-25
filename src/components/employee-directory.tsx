"use client";

import { FormEvent, useState } from "react";
import type { EmployeeProfile, EmployeeStanding } from "./employee-registration";

const standingCopy: Record<EmployeeStanding, { label: string; description: string }> = {
  new: { label: "New", description: "Not yet rated" },
  good: { label: "Good standing", description: "Reliable performance" },
  watch: { label: "Needs attention", description: "Feedback to review" },
  risk: { label: "At risk", description: "Owner follow-up needed" },
};

const money = (value: number) => new Intl.NumberFormat("en-US",
  { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function EmployeeDirectory({ employees, onSetActive, onInvite, onResetPassword }: {
  employees: EmployeeProfile[]; onSetActive: (id: string, active: boolean) => void;
  onInvite?: (firstName: string, lastName: string, email: string, language: "English" | "Español") => Promise<string | void>;
  onResetPassword?: (employeeId: string) => Promise<string | void>;
}) {
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onInvite) return;
    const form = new FormData(event.currentTarget);
    setInviting(true); setInviteError("");
    const error = await onInvite(
      String(form.get("firstName")).trim(),
      String(form.get("lastName")).trim(),
      String(form.get("email")).trim(),
      String(form.get("language")) as "English" | "Español",
    );
    setInviting(false);
    if (error) setInviteError(error);
    else setInviteOpen(false);
  }

  if (selected) return <EmployeeDetail employee={selected} onBack={() => setSelected(null)}
    onResetPassword={onResetPassword}
    onSetActive={(active) => {
      onSetActive(selected.id, active);
      setSelected({ ...selected, active });
    }} />;

  return <div className="employee-directory">
    <div className="directory-heading"><div><h2>Employees</h2>
      <p>Invitations, contact details, standing, and payment history.</p></div>
      <div className="directory-actions"><span>{employees.length} employees</span>
        {onInvite && <button className="primary compact" onClick={() => setInviteOpen(true)}>＋ Invite employee</button>}</div></div>
    <div className="employee-stack">
      {employees.map((employee) => <button className="employee-row" key={employee.id} onClick={() => setSelected(employee)}>
        <div className="employee-initials">{employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="employee-name"><b>{employee.name}</b><span>{employee.employeeNumber ? `SC-${String(employee.employeeNumber).padStart(6, "0")} · ` : ""}{employee.phone || employee.email}</span>
          <span className={`account-status ${employee.active ? "active" : "inactive"}`}>
            <i />{employee.active ? "Active" : employee.phone ? "Inactive" : "Invitation pending"}
          </span>
        </div>
        <StandingRing employee={employee} />
        <span className="employee-chevron">›</span>
      </button>)}
    </div>
    {inviteOpen && <div className="modal-backdrop"><section className="modal invite-modal">
      <button className="close" aria-label="Close" onClick={() => setInviteOpen(false)}>×</button>
      <p className="eyebrow">EMPLOYEE ONBOARDING</p><h2>Invite an employee</h2>
      <p className="form-intro">They’ll receive a welcome email with iPhone and Android application links.</p>
      <form onSubmit={submitInvite}>
        <label>First name<input name="firstName" autoComplete="given-name" required /></label>
        <label>Last name<input name="lastName" autoComplete="family-name" required /></label>
        <label className="wide">Email address<input name="email" type="email" autoComplete="email" required /></label>
        <label className="wide">Invitation language
          <select name="language" defaultValue="English" required>
            <option value="English">English</option><option value="Español">Español</option>
          </select>
          <small className="field-note">The welcome email and registration screen will use this language.</small>
        </label>
        {inviteError && <p className="form-error wide">{inviteError}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button className="primary" disabled={inviting}>{inviting ? "Sending…" : "Send invitation"}</button></div>
      </form>
    </section></div>}
    <p className="score-explainer">Standing uses documented attendance, completed work, and customer feedback. New employees remain unrated until enough work history exists.</p>
  </div>;
}

function StandingRing({ employee }: { employee: EmployeeProfile }) {
  const standing = standingCopy[employee.standing];
  return <div className={`standing standing-${employee.standing}`}>
    <span className="standing-ring">{employee.score ?? "—"}{employee.score !== null && <small>%</small>}</span>
    <span><b>{standing.label}</b><small>{standing.description}</small></span>
  </div>;
}

function EmployeeDetail({ employee, onBack, onSetActive, onResetPassword }: {
  employee: EmployeeProfile; onBack: () => void; onSetActive: (active: boolean) => void;
  onResetPassword?: (employeeId: string) => Promise<string | void>;
}) {
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  function toggleActive() {
    const action = employee.active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${action} ${employee.name}'s account?`)) return;
    onSetActive(!employee.active);
  }
  async function resetPassword() {
    if (!onResetPassword || !window.confirm(`Send a secure password reset email to ${employee.email}?`)) return;
    setResettingPassword(true); setResetMessage(""); setResetError("");
    const error = await onResetPassword(employee.id);
    setResettingPassword(false);
    if (error) setResetError(error);
    else setResetMessage(`Password reset email sent to ${employee.email}.`);
  }
  return <div className="employee-detail">
    <button className="detail-back" onClick={onBack}>← All employees</button>
    <div className="profile-header">
      <div className="profile-avatar">{employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
      <div><p className="eyebrow">EMPLOYEE PROFILE</p><h2>{employee.name}</h2>
        <p className="employee-id">Employee ID: <b>{employee.employeeNumber ? `SC-${String(employee.employeeNumber).padStart(6, "0")}` : "Pending setup"}</b></p>
        <p>Team member since {new Date(employee.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <span className={`account-status ${employee.active ? "active" : "inactive"}`}>
          <i />{employee.active ? "Active" : "Inactive"}</span></div>
      <StandingRing employee={employee} />
    </div>
    <div className="account-actions">
      <div><b>{employee.active ? "Active account" : "Inactive account"}</b>
        <span>{employee.active ? "Can receive and accept new work." : "Cannot receive or accept new work."}</span></div>
      <div className="employee-account-buttons">
        {onResetPassword && <button className="reset-password-button" disabled={resettingPassword} onClick={() => void resetPassword()}>
          {resettingPassword ? "Sending…" : "Send password reset"}</button>}
        <button className={employee.active ? "deactivate-button" : "reactivate-button"} onClick={toggleActive}>
          {employee.active ? "Deactivate employee" : "Reactivate employee"}</button>
      </div>
    </div>
    {resetMessage && <p className="account-action-message success">{resetMessage}</p>}
    {resetError && <p className="account-action-message error">{resetError}</p>}
    <div className="payment-summary">
      <div><span>Paid this month</span><strong>{money(employee.paidMonth)}</strong></div>
      <div><span>Paid this year</span><strong>{money(employee.paidYear)}</strong></div>
      <div><span>Lifetime paid</span><strong>{money(employee.paidLifetime)}</strong></div>
    </div>
    <div className="profile-grid">
      <section><h3>Personal information</h3>
        <dl><dt>First name</dt><dd>{employee.firstName}</dd><dt>Last name</dt><dd>{employee.lastName}</dd>
          <dt>Date of birth</dt><dd>{employee.dateOfBirth
            ? new Date(`${employee.dateOfBirth}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "Not provided"}</dd>
          <dt>Email</dt><dd>{employee.email}</dd><dt>Phone</dt><dd>{employee.phone}</dd>
          <dt>Home address</dt><dd>{employee.address || "Not provided"}</dd>
          <dt>Language</dt><dd>{employee.language}</dd><dt>Preferred service area</dt><dd>{employee.serviceArea || "Not specified"}</dd>
          <dt>Emergency contact</dt><dd>{employee.emergencyContact || "Not provided"}</dd></dl></section>
      <section><h3>Payment</h3>
        <dl><dt>Preferred method</dt><dd>{employee.paymentMethod}</dd>
          <dt>Payment contact</dt><dd>{employee.paymentContact}</dd></dl>
        <div className="sensitive-note">Bank account and routing numbers are not stored in this app.</div></section>
      <section><h3>Work history</h3>
        <dl><dt>Completed jobs</dt><dd>{employee.completedJobs}</dd>
          <dt>Attendance</dt><dd>{employee.attendanceRate === null ? "Not yet rated" : `${employee.attendanceRate}%`}</dd>
          <dt>Standing note</dt><dd>{employee.standingNote}</dd></dl></section>
      <section className="audit-history"><h3>Profile audit history</h3>
        {employee.auditHistory?.length ? <div className="audit-list">{employee.auditHistory.map((entry) =>
          <article key={entry.id}><div><b>{entry.action === "created" ? "Profile created" : "Profile updated"}</b>
            <time>{new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.changedAt))} Arizona time</time></div>
            <p>{entry.action === "created" ? "Employee profile created" : `Changed: ${entry.changedFields.map(formatAuditField).join(", ")}`}</p>
            <small>Modified by {entry.modifiedByName} ({entry.modifiedByRole})</small>
          </article>)}</div> : <p className="audit-empty">No profile changes have been recorded yet.</p>}
      </section>
    </div>
  </div>;
}

function formatAuditField(field: string) {
  const labels: Record<string, string> = {
    full_name: "name", first_name: "first name", last_name: "last name", date_of_birth: "date of birth",
    email: "email", address: "home address", preferred_language: "language", phone: "phone number",
    payment_method: "payment method", payment_contact: "payment contact", service_area: "service area",
    emergency_contact: "emergency contact", onboarding_complete: "registration status", standing: "standing",
    performance_score: "performance score", standing_note: "standing note", active: "account status",
  };
  return labels[field] || field.replaceAll("_", " ");
}
