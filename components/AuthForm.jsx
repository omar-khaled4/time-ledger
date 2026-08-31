"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthForm() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>
          Time <span style={{ color: "#C98A3B" }}>Ledger</span>
        </h1>
        <p style={styles.sub}>{mode === "signin" ? "Sign in to your ledger" : "Create your account"}</p>

        <label style={styles.label}>Email</label>
        <input style={styles.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <label style={styles.label}>Password</label>
        <input style={styles.input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <p style={styles.error}>{error}</p>}
        {notice && <p style={styles.notice}>{notice}</p>}

        <button style={styles.btn} disabled={loading} type="submit">
          {loading ? "Please wait\u2026" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button"
          style={styles.link}
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", background: "#1B1D22", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 20 },
  card: { background: "#24272E", border: "1px solid #34383F", borderRadius: 14, padding: 32, width: 340 },
  title: { color: "#ECE7DA", margin: "0 0 4px", fontSize: 22 },
  sub: { color: "#9C9C90", fontSize: 13, margin: "0 0 20px" },
  label: { display: "block", color: "#9C9C90", fontSize: 12, margin: "12px 0 6px" },
  input: { width: "100%", background: "#1B1D22", border: "1px solid #34383F", color: "#ECE7DA", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" },
  error: { color: "#B5563E", fontSize: 12, marginTop: 10 },
  notice: { color: "#6E9E76", fontSize: 12, marginTop: 10 },
  btn: { width: "100%", background: "#C98A3B", color: "#1B1D22", border: "none", borderRadius: 8, padding: "11px", fontWeight: 600, fontSize: 14, marginTop: 18, cursor: "pointer" },
  link: { width: "100%", background: "none", border: "none", color: "#9C9C90", fontSize: 12, marginTop: 12, cursor: "pointer" },
};
