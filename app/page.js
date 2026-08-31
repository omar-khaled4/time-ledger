"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Dashboard from "../components/Dashboard";
import AuthForm from "../components/AuthForm";

export default function Page() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const hashType = params.get("type");
    const hashToken = params.get("access_token");
    const queryType = new URLSearchParams(window.location.search).get("type");
    if (hashType === "recovery" && hashToken) {
      setRecovery(true);
    } else if (queryType === "recovery") {
      setRecovery(true);
    }
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (recovery) {
    return <AuthForm initialMode="reset" />;
  }
  if (session === undefined) {
    return (
      <div style={{ background: "#1B1D22", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9C9C90", fontFamily: "system-ui, sans-serif" }}>
        Loading…
      </div>
    );
  }
  if (!session) {
    return <AuthForm initialMode="signin" />;
  }
  return <Dashboard session={session} />;
}
