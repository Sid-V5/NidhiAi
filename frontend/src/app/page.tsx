"use client";
import { useRouter } from "next/navigation";
import { startDemoSession, isLoggedIn } from "@/lib/auth";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) router.push("/dashboard");
  }, [router]);

  const handleDemo = () => {
    startDemoSession();
    router.push("/profile");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", position: "relative" }}>

      {/* Strict Corporate Navbar */}
      <nav style={{ padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "var(--text-primary)", color: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, fontFamily: "var(--font-playfair)" }}>₹</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>NidhiAI</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <ThemeToggle />
          <a href="/signin" className="btn-secondary" style={{ padding: "8px 20px" }}>Sign In</a>
        </div>
      </nav>

      {/* The Hero Container */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>

        <div style={{ margin: "auto 0" }}>
          {/* Typographic Dominance */}
          <div style={{ marginBottom: 48, maxWidth: 800 }}>
            <h2 style={{ fontSize: "4.5rem", fontWeight: 800, lineHeight: 1.05, color: "var(--text-primary)", fontFamily: "var(--font-playfair)" }}>
              Funding the<br />Future.
            </h2>
            <h2 style={{ fontSize: "4rem", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05, color: "var(--text-muted)", fontFamily: "var(--font-playfair)" }}>
              Verified by Code.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>

            <div>
              <p style={{ fontSize: 18, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 32, maxWidth: 500 }}>
                Bridging India's ₹38,000 Cr CSR Funding Gap. A dedicated institutional ledger bridging verified NGOs with precision corporate funding via AI.
              </p>
              <div style={{ display: "flex", gap: "16px" }}>
                <button onClick={handleDemo} className="btn-primary" style={{ padding: "14px 36px", fontSize: 16 }}>
                  Initialize Demo
                </button>
              </div>

              <div style={{ marginTop: 32, display: "flex", gap: "12px", alignItems: "center", fontFamily: "var(--font-space-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                <span>SYSTEM STATUS:</span>
                <span className="badge badge-valid">OPERATIONAL</span>
              </div>
            </div>

            {/* Institutional Features */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { icon: "01", title: "Compliance Check", desc: "AI-powered verification of 12A, 80G, and CSR-1 registration certificates." },
                { icon: "02", title: "Intelligent Match", desc: "Semantic matching engine connects your NGO to high-probability grants." },
                { icon: "03", title: "Live Drafting", desc: "AI-generated proposals streamed live onto a formatted document canvas." },
                { icon: "04", title: "Audit Ready", desc: "Immutable impact logs designed for donor and stakeholder verification." },
              ].map(f => (
                <div key={f.icon} className="corporate-card" style={{ padding: "24px" }}>
                  <div style={{ fontFamily: "var(--font-space-mono)", fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>// {f.icon}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-playfair)" }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      <div style={{ padding: "24px 40px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-space-mono)" }}>
        <div>V 1.0.0 / AI FOR BHARAT HACKATHON 2026</div>
        <div>POWERED BY AWS</div>
      </div>
    </div>
  );
}
