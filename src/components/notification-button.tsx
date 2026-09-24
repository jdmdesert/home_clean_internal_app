"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppLanguage } from "@/lib/language";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function NotificationButton({ compact = false }: { compact?: boolean }) {
  const { spanish } = useAppLanguage();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => setEnabled(false));
  }, []);

  async function enable() {
    if (!supabase || !publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage(spanish ? "Las notificaciones aún no están configuradas en este dispositivo." : "Notifications are not configured on this device yet.");
      return;
    }
    setWorking(true); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(spanish ? "No se concedió permiso para notificaciones." : "Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("The phone returned an incomplete subscription.");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again.");
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userData.user.id, endpoint: json.endpoint,
        p256dh: json.keys.p256dh, auth: json.keys.auth,
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setEnabled(true);
      setMessage(spanish ? "Notificaciones activadas en este dispositivo." : "Notifications enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (spanish ? "No se pudieron activar las notificaciones." : "Notifications could not be enabled."));
    } finally { setWorking(false); }
  }

  return <div className={`notification-optin${compact ? " compact-optin" : ""}`}>
    <button className="secondary" onClick={enable} disabled={working || enabled}>
      {working ? (spanish ? "Activando…" : "Enabling…") : enabled ? (spanish ? "Notificaciones activadas" : "Notifications enabled") : (spanish ? "Activar notificaciones" : "Enable notifications")}
    </button>
    {message && <small>{message}</small>}
  </div>;
}
