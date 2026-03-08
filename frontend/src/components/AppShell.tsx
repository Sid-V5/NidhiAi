"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { isLoggedIn } from "@/lib/auth";

const PUBLIC_ROUTES = ["/", "/signin"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    const [authChecked, setAuthChecked] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isPublic && !isLoggedIn()) {
            router.replace("/signin");
        } else {
            setAuthChecked(true);
        }
    }, [pathname, isPublic, router]);

    // Close sidebar on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    if (isPublic) {
        return <>{children}</>;
    }

    if (!authChecked) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Authenticating...</div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Hamburger toggle — always visible at top-left */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="sidebar-toggle"
                aria-label="Toggle sidebar"
                style={{
                    position: "fixed",
                    top: 16,
                    left: 16,
                    zIndex: 100,
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    transition: "all 0.2s ease",
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    {sidebarOpen ? (
                        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    ) : (
                        <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                    )}
                </svg>
            </button>

            {/* Backdrop overlay when sidebar is open */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.4)",
                        zIndex: 49,
                        transition: "opacity 0.3s ease",
                    }}
                />
            )}

            <div className={sidebarOpen ? "sidebar-open" : "sidebar-closed"}>
                <Sidebar />
            </div>

            <main className="page-container" style={{ marginLeft: 0, maxWidth: "100vw", paddingTop: 64 }}>
                {children}
            </main>
        </>
    );
}
