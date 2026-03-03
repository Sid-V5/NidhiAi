"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";

import { ThemeToggle } from "./ThemeToggle";

const navItems = [
    { href: "/dashboard", icon: "📊", label: "Dashboard" },
    { href: "/profile", icon: "🏢", label: "NGO Profile" },
    { href: "/upload", icon: "📤", label: "Upload Documents" },
    { href: "/compliance", icon: "⚖️", label: "Compliance" },
    { href: "/grants", icon: "🔍", label: "Find Grants" },
    { href: "/proposals", icon: "📄", label: "Proposals" },
    { href: "/reports", icon: "📈", label: "Impact Reports" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const session = getSession();

    const handleSignOut = () => {
        clearSession();
        router.push("/");
    };

    return (
        <aside className="sidebar">
            <Link href="/dashboard" className="sidebar-brand">
                <div className="sidebar-logo">₹</div>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>NidhiAI</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>AI Funding Officer</div>
                </div>
            </Link>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}

                <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

                <Link
                    href="/chatbot"
                    className={`sidebar-link ${pathname === "/chatbot" ? "active" : ""}`}
                >
                    <span>💬</span>
                    <span>Ask about CSR</span>
                </Link>
            </nav>

            <div className="sidebar-footer">
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, padding: "0 14px" }}>
                    {session.ngoName || "Setup Profile"}
                    {session.isDemo && <span className="badge badge-pending" style={{ marginLeft: 6 }}>DEMO</span>}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '0 14px', marginBottom: '8px' }}>
                    <ThemeToggle />
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Theme</span>
                </div>

                <button
                    onClick={handleSignOut}
                    className="sidebar-link"
                    style={{ border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}
                >
                    <span>🚪</span>
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
