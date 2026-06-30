"use client";

import { FormEvent, useState } from "react";

export type EmployeeStanding = "new" | "good" | "watch" | "risk";

export type EmployeeProfile = {
  id: string;
  language: "English" | "Español";
  name: string;
  email: string;
  phone: string;
  paymentMethod: "Zelle" | "ACH" | "Check" | "Other";
  paymentContact: string;
  serviceArea: string;
  emergencyContact: string;
  joinedAt: string;
  standing: EmployeeStanding;
  score: number | null;
  standingNote: string;
  completedJobs: number;
  attendanceRate: number | null;
  paidMonth: number;
  paidYear: number;
  paidLifetime: number;
};

export function EmployeeRegistration({ onComplete, onCancel }: {
  onComplete: (employee: EmployeeProfile) => void;
  onCancel?: () => void;
}) {
  const [language, setLanguage] = useState<"English" | "Español" | null>(null);
  const spanish = language === "Español";
  const copy = spanish ? {
    eyebrow: "REGISTRO DE EMPLEADO", title: "Cuéntanos sobre ti",
    intro: "Esta información se utiliza para trabajo y pagos.",
    name: "Nombre completo", email: "Correo electrónico", phone: "Número de teléfono",
    payment: "¿Cómo prefieres recibir tu pago?", paymentContact: "Correo o teléfono para el pago",
    area: "Ciudades o área donde prefieres trabajar", emergency: "Contacto de emergencia (opcional)",
    consent: "Confirmo que esta información es correcta y acepto recibir avisos de trabajo.",
    submit: "Terminar registro", back: "Atrás",
  } : {
    eyebrow: "EMPLOYEE REGISTRATION", title: "Tell us about yourself",
    intro: "We use this information for work communication and payments.",
    name: "Full name", email: "Email address", phone: "Phone number",
    payment: "How would you like to be paid?", paymentContact: "Email or phone used for payment",
    area: "Cities or area where you prefer to work", emergency: "Emergency contact (optional)",
    consent: "I confirm this information is correct and agree to receive work notifications.",
    submit: "Finish registration", back: "Back",
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!language) return;
    const data = new FormData(event.currentTarget);
    const method = String(data.get("paymentMethod")) as EmployeeProfile["paymentMethod"];
    onComplete({
      id: crypto.randomUUID(), language, name: String(data.get("name")),
      email: String(data.get("email")), phone: String(data.get("phone")),
      paymentMethod: method, paymentContact: String(data.get("paymentContact")),
      serviceArea: String(data.get("serviceArea")), emergencyContact: String(data.get("emergencyContact")),
      joinedAt: new Date().toISOString(), standing: "new", score: null,
      standingNote: "Not enough work history to calculate a standing.",
      completedJobs: 0, attendanceRate: null, paidMonth: 0, paidYear: 0, paidLifetime: 0,
    });
  }

  if (!language) {
    return <section className="registration-shell">
      <div className="language-card">
        <div className="registration-logo">D</div>
        <p className="eyebrow">WELCOME · BIENVENIDO</p>
        <h1>Choose your language</h1>
        <p>Elige tu idioma</p>
        <div className="language-options">
          <button onClick={() => setLanguage("English")}><b>English</b><span>Continue in English →</span></button>
          <button onClick={() => setLanguage("Español")}><b>Español</b><span>Continuar en español →</span></button>
        </div>
        {onCancel && <button className="text-button" onClick={onCancel}>Return to preview</button>}
      </div>
    </section>;
  }

  return <section className="registration-shell">
    <div className="registration-card">
      <button className="registration-back" onClick={() => setLanguage(null)}>← {copy.back}</button>
      <p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p>
      <form onSubmit={submit}>
        <label>{copy.name}<input name="name" autoComplete="name" required /></label>
        <label>{copy.email}<input name="email" type="email" autoComplete="email" required /></label>
        <label>{copy.phone}<input name="phone" type="tel" autoComplete="tel" required placeholder="(602) 555-0100" /></label>
        <label>{copy.payment}
          <select name="paymentMethod" required>
            <option value="Zelle">Zelle</option><option value="ACH">ACH / Direct deposit</option>
            <option value="Check">Check</option><option value="Other">Other</option>
          </select>
        </label>
        <label>{copy.paymentContact}
          <input name="paymentContact" required placeholder={spanish ? "No ingrese números de cuenta bancaria" : "Do not enter bank account numbers"} />
          <small>ACH bank details will be collected later through a secure payment provider.</small>
        </label>
        <label>{copy.area}<input name="serviceArea" placeholder="Phoenix, Scottsdale, Tempe" /></label>
        <label>{copy.emergency}<input name="emergencyContact" placeholder="Name and phone number" /></label>
        <label className="consent"><input name="consent" type="checkbox" required /><span>{copy.consent}</span></label>
        <button className="primary">{copy.submit}</button>
      </form>
    </div>
  </section>;
}
