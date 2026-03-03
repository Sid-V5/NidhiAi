"use client";
import { useEffect, useState } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getComplianceStatus, searchGrants, listProposals, invokeAgent } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AgentTrace {
    agent: string; action: string; detail: string; timestamp: string;
    status: "complete" | "active" | "pending";
}

export default function DashboardPage() {
    const session = getSession();
    const router = useRouter();
    const [stats, setStats] = useState({ docs: "...", grants: "...", proposals: "...", score: "..." });
    const [traces, setTraces] = useState<AgentTrace[]>([]);
    const [loading, setLoading] = useState(true);
    const [traceLoading, setTraceLoading] = useState(false);

    useEffect(() => {
        if (!isProfileComplete()) {
            router.push("/profile");
            return;
        }

        async function loadDashboard() {
            const startTime = Date.now();

            const addTrace = (t: Omit<AgentTrace, "timestamp">) => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                setTraces(prev => [...prev, { ...t, timestamp: `${elapsed}s` }]);
            };

            addTrace({ agent: "SYSTEM", action: "Fetching platform data", detail: "Querying compliance, grants, and proposals in parallel", status: "active" });

            const [compRes, grantRes, propRes] = await Promise.all([
                getComplianceStatus(session.ngoId),
                searchGrants({ ngoSector: session.ngoName ? "Education" : "", ngoDescription: session.ngoName, location: "India" }),
                listProposals(session.ngoId),
            ]);

            if (compRes.ok && compRes.data) {
                const d = compRes.data as Record<string, unknown>;
                const results = (d.results as unknown[]) || [];
                const valid = d.validDocuments as number || 0;
                const total = d.totalDocuments as number || 3;
                setStats(prev => ({ ...prev, docs: `${valid}/${total}`, score: `${Math.round((valid / total) * 100)}%` }));
                addTrace({ agent: "COMPLIANCE", action: `Verified ${results.length} documents`, detail: `${valid} valid, ${total - valid} need attention`, status: "complete" });
            } else {
                setStats(prev => ({ ...prev, docs: "0/0", score: "N/A" }));
                addTrace({ agent: "COMPLIANCE", action: "No documents scanned yet", detail: "Upload 12A, 80G, CSR-1 certificates to begin", status: "pending" });
            }

            if (grantRes.ok && grantRes.data) {
                const grants = grantRes.data.grants || [];
                setStats(prev => ({ ...prev, grants: String(grants.length) }));
                addTrace({ agent: "GRANT SCOUT", action: `Found ${grants.length} matching opportunities`, detail: grantRes.data!.summary || "Semantic matching complete", status: "complete" });
            } else {
                setStats(prev => ({ ...prev, grants: "0" }));
                addTrace({ agent: "GRANT SCOUT", action: "Grant search pending", detail: "Complete profile for personalized matches", status: "pending" });
            }

            if (propRes.ok && propRes.data) {
                const proposals = propRes.data.proposals || [];
                setStats(prev => ({ ...prev, proposals: String(proposals.length) }));
                if (proposals.length > 0) {
                    addTrace({ agent: "PROPOSALS", action: `${proposals.length} proposals generated`, detail: "PDF documents stored and ready for download", status: "complete" });
                }
            } else {
                setStats(prev => ({ ...prev, proposals: "0" }));
            }

            addTrace({ agent: "SYSTEM", action: "Dashboard ready", detail: "All data loaded successfully", status: "complete" });
            setLoading(false);
        }
        loadDashboard();
    }, [session.ngoId, session.ngoName, router]);

    const runSupervisorTrace = async () => {
        setTraceLoading(true);
        const startTime = Date.now();
        const addTrace = (t: Omit<AgentTrace, "timestamp">) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            setTraces(prev => [...prev, { ...t, timestamp: `${elapsed}s` }]);
        };

        addTrace({ agent: "AI ASSISTANT", action: "Running diagnostics", detail: "Analyzing your NGO's current status across all modules", status: "active" });

        const res = await invokeAgent(
            process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID || "HB82HPMIA3",
            `Give a brief status summary for NGO "${session.ngoName}" (ID: ${session.ngoId}). Check compliance status, available grants, and pending proposals.`
        );

        if (res.ok && res.data) {
            const data = res.data as Record<string, unknown>;
            const output = (data.output || data.response || "") as string;
            const traceEvents = (data.trace || data.traceEvents || []) as Record<string, unknown>[];

            if (traceEvents.length > 0) {
                traceEvents.forEach((evt) => {
                    addTrace({
                        agent: (evt.agentName as string || "SYSTEM").toUpperCase(),
                        action: (evt.action as string) || (evt.type as string) || "Processing",
                        detail: (evt.observation as string) || (evt.output as string) || JSON.stringify(evt).slice(0, 120),
                        status: "complete",
                    });
                });
            } else {
                addTrace({ agent: "AI ASSISTANT", action: "Analysis complete", detail: output.slice(0, 200) || "Status check completed", status: "complete" });
            }
        } else {
            addTrace({ agent: "AI ASSISTANT", action: "Analysis complete", detail: res.error || "Check configuration", status: "complete" });
        }

        setTraceLoading(false);
    };

    const agentColor = (agent: string) => {
        if (agent === "COMPLIANCE") return "var(--blue)";
        if (agent === "GRANT SCOUT") return "var(--green)";
        if (agent === "PROPOSALS") return "#D97706";
        return "var(--accent)";
    };

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Welcome back, {session.ngoName || "Setup your profile"}. Here is your funding overview.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                    { icon: "⚖️", value: stats.docs, label: "Documents Verified", href: "/compliance" },
                    { icon: "🔍", value: stats.grants, label: "Grants Matched", href: "/grants" },
                    { icon: "📝", value: stats.proposals, label: "Proposals Generated", href: "/proposals" },
                    { icon: "📊", value: stats.score, label: "Compliance Score", href: "/compliance" },
                ].map((s) => (
                    <a key={s.label} href={s.href} className="corporate-card" style={{ textDecoration: "none", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 24 }}>{s.icon}</span>
                            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : null}
                        </div>
                        <div style={{ marginTop: 16, fontSize: 32, fontWeight: 700, fontFamily: "var(--font-space-mono)", color: "var(--text-primary)" }}>{s.value}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{s.label}</div>
                    </a>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                <div className="corporate-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Activity Log</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={runSupervisorTrace} disabled={traceLoading}
                                className="btn-secondary" style={{ fontSize: 11, padding: "6px 12px" }}>
                                {traceLoading ? "⚡ Running..." : "▶ Run Diagnostics"}
                            </button>
                            <span className="badge badge-processing">Live</span>
                        </div>
                    </div>
                    {traces.length === 0 && loading && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div className="spinner" /><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading data...</span>
                        </div>
                    )}
                    {traces.length === 0 && !loading && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No activity yet. Upload documents to get started.</div>
                    )}
                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                        {traces.map((t, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
                                    background: t.status === "complete" ? "rgba(16,185,129,0.1)" : t.status === "active" ? "rgba(245,158,11,0.1)" : "rgba(148,163,184,0.1)"
                                }}>
                                    {t.status === "complete" ? "✅" : t.status === "active" ? "⚡" : "⏳"}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: agentColor(t.agent) }}>{t.agent}</span>
                                        <span className="telemetry-text" style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.timestamp}</span>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.action}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="corporate-card">
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <a href="/upload" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>📤 Upload Documents</a>
                        <a href="/grants" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>🔍 Find Grants</a>
                        <a href="/reports" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>📈 Generate Report</a>
                        <a href="/chatbot" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>💬 Ask about CSR</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
