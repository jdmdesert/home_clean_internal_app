"use client";

import { useState } from "react";
import type { EmployeeProfile, EmployeeStanding } from "./employee-registration";

const standingCopy: Record<EmployeeStanding, { label: string; description: string }> = {
  new: { label: "New", description: "Not yet rated" },
  good: { label: "Good standing", description: "Reliable performance" },
  watch: { label: "Needs attention", description: "Feedback to review" },
  risk: { label: "At risk", description: "Owner follow-up needed" },
};

const money = (value: number) => new Intl.NumberFormat("en-US",
  { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function EmployeeDirectory({ employees }: { employees: EmployeeProfile[] }) {
  const [selected, setSelected] = useState<EmployeeProfile | null>(null);

  if (selected) return <EmployeeDetail employee={selected} onBack={() => setSelected(null)} />;

  return <div className="employee-directory">
    <div className="directory-heading"><div><h2>Registered employees</h2>
      <p>Contact details, standing, and payment history.</p></div><span>{employees.length} employees</span></div>
    <div className="employee-stack">
      {employees.map((employee) => <button className="employee-row" key={employee.id} onClick={() => setSelected(employee)}>
        <div className="employee-initials">{employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="employee-name"><b>{employee.name}</b><span>{employee.phone}</span></div>
        <StandingRing employee={employee} />
        <span className="employee-chevron">›</span>
      </button>)}
    </div>
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

function EmployeeDetail({ employee, onBack }: { employee: EmployeeProfile; onBack: () => void }) {
  return <div className="employee-detail">
    <button className="detail-back" onClick={onBack}>← All employees</button>
    <div className="profile-header">
      <div className="profile-avatar">{employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
      <div><p className="eyebrow">EMPLOYEE PROFILE</p><h2>{employee.name}</h2>
        <p>Team member since {new Date(employee.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p></div>
      <StandingRing employee={employee} />
    </div>
    <div className="payment-summary">
      <div><span>Paid this month</span><strong>{money(employee.paidMonth)}</strong></div>
      <div><span>Paid this year</span><strong>{money(employee.paidYear)}</strong></div>
      <div><span>Lifetime paid</span><strong>{money(employee.paidLifetime)}</strong></div>
    </div>
    <div className="profile-grid">
      <section><h3>Personal information</h3>
        <dl><dt>Email</dt><dd>{employee.email}</dd><dt>Phone</dt><dd>{employee.phone}</dd>
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
    </div>
  </div>;
}
