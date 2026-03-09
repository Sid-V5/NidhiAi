"use client";
import { useRouter } from "next/navigation";
import { startDemoSession, isLoggedIn } from "@/lib/auth";
import { useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import gsap from "gsap";

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const cardsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoggedIn()) router.push("/dashboard");
  }, [router]);

  /* ── Animated particle canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    let animId: number;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    const count = 80;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5, o: Math.random() * 0.4 + 0.1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(99, 102, 241, ${0.12 * (1 - dist / 150)})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(99, 102, 241, ${p.o * 1.2})`;
        ctx!.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* ── GSAP orchestrated page load ── */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Navbar slides in
    tl.fromTo(navRef.current, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });

    // Hero headline staggers in
    tl.fromTo(
      heroRef.current?.querySelectorAll(".hero-line") || [],
      { y: 60, opacity: 0, skewY: 3 },
      { y: 0, opacity: 1, skewY: 0, duration: 0.8, stagger: 0.15 },
      "-=0.2"
    );

    // Description and CTA
    tl.fromTo(ctaRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3");

    // Feature cards stagger in
    tl.fromTo(
      cardsRef.current?.querySelectorAll(".feature-card") || [],
      { y: 40, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.1 },
      "-=0.3"
    );


  }, []);

  const handleDemo = () => {
    startDemoSession();
    router.push("/profile");
  };

  const features = [
    { num: "01", title: "Compliance Check", desc: "AI-powered verification of 12A, 80G, and CSR-1 registration certificates.", icon: "⚖️" },
    { num: "02", title: "Intelligent Match", desc: "Semantic matching engine connects your NGO to high-probability grants.", icon: "🔍" },
    { num: "03", title: "Live Drafting", desc: "AI-generated proposals streamed live onto a formatted document canvas.", icon: "📝" },
    { num: "04", title: "Multi-Agent AI", desc: "5 specialized Bedrock agents collaborating to automate the entire CSR funding lifecycle.", icon: "🤖" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Animated Canvas Background */}
      <canvas ref={canvasRef} style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: "var(--bg-primary)",
      }} />

      {/* CSS Gradient Overlays */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 80% 50% at 70% 10%, rgba(99, 102, 241, 0.10) 0%, transparent 70%),
          radial-gradient(ellipse 50% 40% at 15% 85%, rgba(79, 70, 229, 0.06) 0%, transparent 60%)
        `,
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Navbar */}
        <nav ref={navRef} style={{
          padding: "20px 40px", opacity: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          background: "rgba(9, 9, 11, 0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              background: "linear-gradient(135deg, var(--accent), #818CF8)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, fontFamily: "var(--font-playfair)",
              borderRadius: 6,
            }}>₹</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>NidhiAI</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <ThemeToggle />
            <a href="/signin" className="btn-secondary" style={{ padding: "8px 20px", backdropFilter: "blur(8px)" }}>Sign In</a>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "60px 40px 40px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          <div style={{ margin: "auto 0" }}>

            {/* Headlines */}
            <div ref={heroRef} style={{ marginBottom: 48, maxWidth: 800, overflow: "hidden" }}>
              <h2 className="hero-line" style={{
                fontSize: "4.5rem", fontWeight: 800, lineHeight: 1.05,
                color: "var(--text-primary)", fontFamily: "var(--font-playfair)",
                opacity: 0,
              }}>
                Funding the
              </h2>
              <h2 className="hero-line" style={{
                fontSize: "4.5rem", fontWeight: 800, lineHeight: 1.05,
                color: "var(--text-primary)", fontFamily: "var(--font-playfair)",
                opacity: 0,
              }}>
                Future.
              </h2>
              <h2 className="hero-line" style={{
                fontSize: "4rem", fontWeight: 400, fontStyle: "italic", lineHeight: 1.10,
                background: "linear-gradient(135deg, #818CF8, #6366F1, #A5B4FC)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "var(--font-playfair)",
                opacity: 0,
              }}>
                Verified by Code.
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "start" }}>

              {/* Left: Description + CTA */}
              <div ref={ctaRef} style={{ opacity: 0 }}>
                <p style={{ fontSize: 18, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 32, maxWidth: 500 }}>
                  Helping NGOs access CSR funding faster. An AI system that verifies compliance, discovers matching grants, and generates professional proposals in under 10 minutes.
                </p>

                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <button onClick={handleDemo} className="btn-primary" style={{
                    padding: "16px 40px", fontSize: 16,
                    background: "linear-gradient(135deg, var(--accent), #818CF8)",
                    border: "none",
                    boxShadow: "0 0 40px rgba(99, 102, 241, 0.25)",
                  }}>
                    Try the Demo
                  </button>
                  <a href="/signin" style={{
                    padding: "16px 32px", fontSize: 15, fontWeight: 500,
                    color: "var(--text-secondary)", textDecoration: "none",
                    border: "1px solid var(--border)", borderRadius: 4,
                  }}>
                    Sign In →
                  </a>
                </div>

                <p style={{
                  fontSize: 12, color: "var(--text-muted)", marginTop: 14,
                  fontFamily: "var(--font-space-mono)",
                }}>
                  Sign in for the full experience with all features
                </p>


              </div>

              {/* Right: Feature Cards */}
              <div ref={cardsRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {features.map((f) => (
                  <div key={f.num} className="feature-card" style={{
                    padding: "24px",
                    background: "var(--bg-card)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 8,
                    opacity: 0,
                    cursor: "default",
                    transition: "border-color 0.3s ease, background 0.3s ease, transform 0.3s ease",
                  }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--accent)";
                      el.style.background = "rgba(99, 102, 241, 0.06)";
                      gsap.to(el, { y: -4, duration: 0.3, ease: "power2.out" });
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--card-border)";
                      el.style.background = "var(--bg-card)";
                      gsap.to(el, { y: 0, duration: 0.3, ease: "power2.out" });
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-playfair)" }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "20px 40px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between",
          fontSize: 12, color: "var(--text-muted)",
          fontFamily: "var(--font-space-mono)",
          backdropFilter: "blur(8px)",
          background: "rgba(9, 9, 11, 0.3)",
        }}>
          <div>&copy; 2026 NidhiAI</div>
          <div>BUILT ON AWS</div>
        </div>
      </div>
    </div>
  );
}
