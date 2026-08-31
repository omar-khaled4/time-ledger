"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Dashboard from "../components/Dashboard";
import AuthForm from "../components/AuthForm";

export default function Page() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: "#1B1D22", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9C9C90", fontFamily: "system-ui, sans-serif" }}>
        Loading\u2026
      </div>
    );
  }
  if (!session) {
    return <AuthForm />;
  }
  return <Dashboard session={session} />;
}
