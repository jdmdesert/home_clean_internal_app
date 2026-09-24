"use client";

import { FormEvent, useState } from "react";
import { createId } from "@/lib/create-id";
import { useAppLanguage } from "@/lib/language";

export type EmployeeStanding = "new" | "good" | "watch" | "risk";

export type EmployeeProfile = {
  id: string;
  language: "English" | "Español";
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  email: string;
  address: string;
  phone: string;
  paymentMethod: "Zelle" | "ACH" | "Check" | "Other";
  paymentContact: string;
  serviceArea: string;
  emergencyContact: string;
  joinedAt: string;
  active: boolean;
  standing: EmployeeStanding;
  score: number | null;
  standingNote: string;
  completedJobs: number;
  attendanceRate: number | null;
  paidMonth: number;
  paidYear: number;
  paidLifetime: number;
};

export function EmployeeRegistration({ onComplete }: {
  onComplete: (employee: EmployeeProfile, password: string) => Promise<string | void> | string | void;
  onCancel?: () => void;
}) {
  const { language: appLanguage, setLanguage: setAppLanguage } = useAppLanguage();
  const language: "English" | "Español" = appLanguage === "es" ? "Español" : "English";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const spanish = language === "Español";
  const copy = spanish ? {
    eyebrow: "REGISTRO DE EMPLEADO", title: "Cuéntanos sobre ti",
    intro: "Esta información se utiliza para trabajo y pagos.",
    firstName: "Nombre", lastName: "Apellido", dob: "Fecha de nacimiento",
    email: "Correo electrónico", phone: "Número de teléfono", address: "Dirección de casa",
    payment: "¿Cómo prefieres recibir tu pago?", paymentContact: "Correo o teléfono para el pago",
    area: "Ciudades o área donde prefieres trabajar", emergency: "Contacto de emergencia (opcional)",
    consent: "Confirmo que esta información es correcta y acepto recibir avisos de trabajo.",
    submit: "Terminar registro", back: "Atrás",
  } : {
    eyebrow: "EMPLOYEE REGISTRATION", title: "Tell us about yourself",
    intro: "We use this information for work communication and payments.",
    firstName: "First name", lastName: "Last name", dob: "Date of birth",
    email: "Email address", phone: "Phone number", address: "Home address",
    payment: "How would you like to be paid?", paymentContact: "Email or phone used for payment",
    area: "Cities or area where you prefer to work", emergency: "Emergency contact (optional)",
    consent: "I confirm this information is correct and agree to receive work notifications.",
    submit: "Finish registration", back: "Back",
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const method = String(data.get("paymentMethod")) as EmployeeProfile["paymentMethod"];
    const firstName = String(data.get("firstName")).trim();
    const lastName = String(data.get("lastName")).trim();
    const password = String(data.get("password"));
    if (password.length < 8) return setError(spanish ? "Use al menos 8 caracteres." : "Use at least 8 characters.");
    if (password !== String(data.get("confirmation"))) return setError(spanish ? "Las contraseñas no coinciden." : "The passwords do not match.");
    setSubmitting(true); setError("");
    const completionError = await onComplete({
      id: createId(), language, firstName, lastName, name: `${firstName} ${lastName}`,
      dateOfBirth: String(data.get("dateOfBirth")),
      email: String(data.get("email")), phone: String(data.get("phone")), address: String(data.get("address")),
      paymentMethod: method, paymentContact: String(data.get("paymentContact")),
      serviceArea: String(data.get("serviceArea")), emergencyContact: String(data.get("emergencyContact")),
      joinedAt: new Date().toISOString(), active: true, standing: "new", score: null,
      standingNote: "Not enough work history to calculate a standing.",
      completedJobs: 0, attendanceRate: null, paidMonth: 0, paidYear: 0, paidLifetime: 0,
    }, password);
    if (completionError) setError(completionError);
    setSubmitting(false);
  }

  return <section className="registration-shell">
    <div className="registration-card">
      <div className="auth-language registration-language">
        <button className={!spanish ? "active" : ""} onClick={() => setAppLanguage("en")}>English</button>
        <button className={spanish ? "active" : ""} onClick={() => setAppLanguage("es")}>Español</button>
      </div>
      <p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p>
      <form onSubmit={submit}>
        <label>{copy.firstName}<input name="firstName" autoComplete="given-name" required /></label>
        <label>{copy.lastName}<input name="lastName" autoComplete="family-name" required /></label>
        <label>{copy.dob}<input name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} required /></label>
        <label>{copy.email}<input name="email" type="email" autoComplete="email" required /></label>
        <label>{copy.phone}<input name="phone" type="tel" autoComplete="tel" required placeholder="(602) 555-0100" /></label>
        <label className="wide">{copy.address}<input name="address" autoComplete="street-address" required /></label>
        <label>{spanish ? "Crear contraseña" : "Create password"}<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>{spanish ? "Confirmar contraseña" : "Confirm password"}<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
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
        {error && <p className="form-error wide">{error}</p>}
        <button className="primary" disabled={submitting}>{submitting ? (spanish ? "Guardando…" : "Saving…") : copy.submit}</button>
      </form>
    </div>
  </section>;
}
