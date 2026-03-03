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

    useEffect(() => {
        if (!isPublic && !isLoggedIn()) {
            router.replace("/signin");
        } else {
            setAuthChecked(true);
        }
    }, [pathname, isPublic, router]);

    if (isPublic) {
        return <>{children}</>;
    }

    // Don't flash protected content before auth check completes
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
            <Sidebar />
            <main className="page-container">{children}</main>
        </>
    );
}
