"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, confirmSignUp, setSession, startDemoSession } from "@/lib/auth";

type Mode = "signin" | "signup" | "confirm";

export default function SignInPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const session = await signIn(email, password);
            setSession(session);
            router.push("/profile");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("not confirmed")) {
                setError("Please verify your email first. Check your inbox for the code.");
                setMode("confirm");
            } else {
                setError(msg);
            }
        }
        setLoading(false);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            await signUp(email, password, name);
            setMode("confirm");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        }
        setLoading(false);
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            await confirmSignUp(email, code);
            const session = await signIn(email, password);
            setSession(session);
            router.push("/profile");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div className="glass-card" style={{ width: "100%", maxWidth: 420, padding: 32 }}>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #f59e0b, #f97316)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#0a0e1a", marginBottom: 12 }}>₹</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>
                        {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Verify email"}
                    </h1>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        {mode === "confirm" ? `We sent a code to ${email}` : "NidhiAI - AI-Powered CSR Funding"}
                    </p>
                </div>

                {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}

                {mode === "signin" && (
                    <form onSubmit={handleSignIn}>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Email</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ngo.org" className="input-field" />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Password</label>
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, uppercase + number" className="input-field" />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 14, padding: "12px 24px", justifyContent: "center" }}>
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#64748b" }}>
                            No account? <button type="button" onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontWeight: 600 }}>Sign up</button>
                        </div>
                    </form>
                )}

                {mode === "signup" && (
                    <form onSubmit={handleSignUp}>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Full Name</label>
                            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="input-field" />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Email</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@ngo.org" className="input-field" />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Password</label>
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, uppercase + number" className="input-field" minLength={8} />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 14, padding: "12px 24px", justifyContent: "center" }}>
                            {loading ? "Creating account..." : "Sign Up"}
                        </button>
                        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#64748b" }}>
                            Have an account? <button type="button" onClick={() => { setMode("signin"); setError(""); }} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontWeight: 600 }}>Sign in</button>
                        </div>
                    </form>
                )}

                {mode === "confirm" && (
                    <form onSubmit={handleConfirm}>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Verification Code</label>
                            <input required value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="input-field" maxLength={6} style={{ textAlign: "center", fontSize: 24, letterSpacing: 8 }} />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 14, padding: "12px 24px", justifyContent: "center" }}>
                            {loading ? "Verifying..." : "Verify & Sign In"}
                        </button>
                    </form>
                )}

                <div style={{ borderTop: "1px solid rgba(148,163,184,0.1)", marginTop: 24, paddingTop: 16, textAlign: "center" }}>
                    <a href="/" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>← Back to home</a>
                </div>
            </div>
        </div>
    );
}
