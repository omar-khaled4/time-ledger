"use client";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthForm({ initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode === "reset" ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        // reset: user clicked the recovery link and is setting a new password
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setNotice("Password updated! Sign back in.");
        setMode("signin");
        setNewPassword("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email) {
      setError("Enter the email for your account first.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setNotice("Check your email for a password reset link.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setNotice("");
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>
          Time <span style={{ color: "#C98A3B" }}>Ledger</span>
        </h1>
        <p style={styles.sub}>
          {mode === "signin" && "Sign in to your ledger"}
          {mode === "signup" && "Create your account"}
          {mode === "reset" && "Set a new password"}
        </p>

        {mode === "reset" ? (
          <>
            <label style={styles.label}>New password</label>
            <input
              style={styles.input}
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </>
        ) : (
          <>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {notice && <p style={styles.notice}>{notice}</p>}

        <button style={styles.btn} disabled={loading} type="submit">
          {loading
            ? "Please wait…"
            : mode === "reset"
            ? "Update password"
            : mode === "signin"
            ? "Sign in"
            : "Sign up"}
        </button>

        {mode === "forgot" ? (
          <>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button style={styles.btn} type="button" onClick={handleForgot} disabled={loading}>
              Send reset link
            </button>
            <button type="button" style={styles.link} onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            {mode === "signin" && (
              <button type="button" style={styles.link} onClick={() => switchMode("forgot")} disabled={loading}>
                Forgot password?
              </button>
            )}
            {mode === "reset" && (
              <button type="button" style={styles.link} onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            )}
            <button
              type="button"
              style={styles.link}
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </>
        )}
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
