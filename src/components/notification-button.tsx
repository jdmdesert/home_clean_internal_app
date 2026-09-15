"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function NotificationButton() {
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  async function enable() {
    if (!supabase || !publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Notifications are not configured on this device yet.");
      return;
    }
    setWorking(true); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
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
      setMessage("Notifications enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifications could not be enabled.");
    } finally { setWorking(false); }
  }

  return <div className="notification-optin">
    <button className="secondary" onClick={enable} disabled={working}>{working ? "Enabling…" : "Enable notifications"}</button>
    {message && <small>{message}</small>}
  </div>;
}
