"use client";
import { useEffect, useState, useCallback } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getComplianceStatus, searchGrants, listProposals, getProfile, invokeAgent } from "@/lib/api";
import { useRouter } from "next/navigation";
import AgentTrace, { type TraceEvent } from "@/components/AgentTrace";

export default function DashboardPage() {
    const session = getSession();
    const router = useRouter();
    const [stats, setStats] = useState({ docs: "...", grants: "...", proposals: "...", score: "..." });
    const [loading, setLoading] = useState(true);

    // Command bar state
    const [prompt, setPrompt] = useState("");
    const [agentRunning, setAgentRunning] = useState(false);
    const [agentTraces, setAgentTraces] = useState<TraceEvent[]>([]);
    const [agentCompletion, setAgentCompletion] = useState("");
    const [agentStartTime, setAgentStartTime] = useState(0);
    const [agentSessionId, setAgentSessionId] = useState<string | undefined>();

    // Compliance status from DynamoDB
    const [complianceStatus, setComplianceStatus] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        if (!isProfileComplete()) {
            router.push("/profile");
            return;
        }

        async function loadDashboard() {
            // Fetch real stats from AWS in parallel
            const [compRes, grantRes, propRes, profileRes] = await Promise.all([
                getComplianceStatus(session.ngoId),
                searchGrants({ ngoSector: session.ngoName || "NGO", ngoDescription: session.ngoName || "NGO", location: "India" }),
                listProposals(session.ngoId),
                getProfile(session.ngoId),
            ]);

            if (compRes.ok && compRes.data) {
                const d = compRes.data as Record<string, unknown>;
                const valid = d.validDocuments as number || 0;
                const total = d.totalDocuments as number || 3;
                setStats(prev => ({ ...prev, docs: `${valid}/${total}`, score: `${Math.round((valid / total) * 100)}%` }));
            } else {
                setStats(prev => ({ ...prev, docs: "0/3", score: "0%" }));
            }

            if (grantRes.ok && grantRes.data) {
                const grants = grantRes.data.grants || [];
                setStats(prev => ({ ...prev, grants: String(grants.length) }));
            } else {
                setStats(prev => ({ ...prev, grants: "0" }));
            }

            if (propRes.ok && propRes.data) {
                const proposals = propRes.data.proposals || [];
                setStats(prev => ({ ...prev, proposals: String(proposals.length) }));
            } else {
                setStats(prev => ({ ...prev, proposals: "0" }));
            }

            if (profileRes.ok && profileRes.data) {
                const profile = profileRes.data as Record<string, unknown>;
                const p = profile.profile as Record<string, unknown>;
                if (p?.complianceStatus) {
                    setComplianceStatus(p.complianceStatus as Record<string, unknown>);
                }
            }

            setLoading(false);
        }
        loadDashboard();
    }, [session.ngoId, session.ngoName, router]);

    // Send prompt to Supervisor Agent
    const handleSubmit = useCallback(async () => {
        const text = prompt.trim();
        if (!text || agentRunning) return;

        const now = Date.now();
        setAgentStartTime(now);
        setAgentRunning(true);
        setAgentCompletion("");
        setAgentTraces([{
            type: "planning",
            agentName: "Supervisor",
            action: "Analyzing request and planning workflow",
            timestamp: now,
            status: "active",
        }]);

        let docsStr = '[]';
        try {
            const compRes = await getComplianceStatus(session.ngoId);
            if (compRes.ok && compRes.data) {
                const results = (compRes.data as Record<string, unknown>).results as Array<Record<string, unknown>> || [];
                const mappedDocs = results.map((r) => {
                    let s3Key = "";
                    try {
                        const parsedResult = typeof r.complianceResult === "string" ? JSON.parse(r.complianceResult) : r.complianceResult;
                        s3Key = (parsedResult as Record<string, unknown>)?.s3Key as string || "";
                    } catch (e) {
                        console.error(e);
                    }
                    return {
                        s3Bucket: "nidhiai-documents",
                        s3Key: s3Key || `${session.ngoId}/compliance/${r.documentType}_cert.pdf`,
                        documentType: r.documentType
                    };
                });
                if (mappedDocs.length > 0) {
                    docsStr = JSON.stringify(mappedDocs);
                }
            }
        } catch (e) {
            console.error("Failed to fetch fresh compliance keys", e);
        }

        const supervisorAgentId = process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID || "HB82HPMIA3";
        const fullPrompt = [
            `NGO: "${session.ngoName}" (ID: ${session.ngoId})`,
            `S3 Bucket: nidhiai-documents`,
            `Documents: ${docsStr}`,
            `Sector: Education | Location: India`,
            `Request: ${text}`,
        ].join("\n");

        const res = await invokeAgent(supervisorAgentId, fullPrompt, agentSessionId);

        if (res.ok && res.data) {
            const { completion, sessionId: sid, traces } = res.data;
            setAgentSessionId(sid);

            // Parse real Bedrock traces into TraceEvent format
            const parsedTraces: TraceEvent[] = [{
                type: "planning",
                agentName: "Supervisor",
                action: "Analyzed request and planned workflow",
                timestamp: now,
                status: "done",
                durationMs: Date.now() - now,
            }];

            if (traces && Array.isArray(traces) && traces.length > 0) {
                traces.forEach((t: unknown) => {
                    const trace = t as Record<string, unknown>;
                    const agentName = (trace.agentName as string) || (trace.agent as string) || (trace.actionGroup as string) || "Supervisor";
                    const action = (trace.action as string) || (trace.type as string) || "Processing";
                    const observation = (trace.observation as string) || (trace.result as string) || undefined;
                    const rationale = (trace.rationale as string) || undefined;

                    parsedTraces.push({
                        type: (trace.type as TraceEvent["type"]) || "agent_invocation",
                        agentName,
                        action,
                        rationale,
                        observation: observation ? observation.slice(0, 300) : undefined,
                        timestamp: Date.now(),
                        status: "done",
                    });
                });
            }

            parsedTraces.push({
                type: "completion",
                agentName: "Supervisor",
                action: "Response generated",
                timestamp: Date.now(),
                status: "done",
            });

            setAgentTraces(parsedTraces);
            setAgentCompletion(completion || "No response generated.");
        } else {
            setAgentTraces(prev => [...prev, {
                type: "error",
                agentName: "Supervisor",
                action: "Agent invocation failed",
                observation: res.error || "Check Bedrock Agent configuration",
                timestamp: Date.now(),
                status: "error",
            }]);
        }

        setAgentRunning(false);
    }, [prompt, agentRunning, agentSessionId, session.ngoId, session.ngoName]);

    const certStatus = (key: string): string => {
        if (!complianceStatus) return "unknown";
        const cert = complianceStatus[key] as Record<string, unknown> | undefined;
        return (cert?.status as string) || "not_uploaded";
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            valid: { bg: "rgba(16,185,129,0.1)", text: "var(--green)" },
            expired: { bg: "rgba(239,68,68,0.1)", text: "var(--red)" },
            pending: { bg: "rgba(245,158,11,0.1)", text: "#D97706" },
            not_uploaded: { bg: "rgba(148,163,184,0.1)", text: "var(--text-muted)" },
            unknown: { bg: "rgba(148,163,184,0.1)", text: "var(--text-muted)" },
        };
        const c = colors[status] || colors.unknown;
        return (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.text, textTransform: "uppercase" }}>
                {status === "not_uploaded" ? "Not Uploaded" : status}
            </span>
        );
    };

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Welcome back, {session.ngoName || "Setup your profile"}. Here is your funding overview.</p>
            </div>

            {/* Command Bar */}
            <div className="command-bar" style={{ marginBottom: 24 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
                <input
                    className="command-bar__input"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="Ask NidhiAI: &quot;Verify my documents and find education grants in Jharkhand&quot;"
                    disabled={agentRunning}
                />
                <button className="command-bar__send" onClick={handleSubmit} disabled={agentRunning || !prompt.trim()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>

            {/* Agent Trace (visible after first prompt or while running) */}
            {(agentTraces.length > 0 || agentRunning) && (
                <div style={{ marginBottom: 24 }}>
                    <AgentTrace
                        traces={agentTraces}
                        isRunning={agentRunning}
                        startTime={agentStartTime}
                        completion={agentCompletion}
                    />
                </div>
            )}

            {/* Sample prompts */}
            {agentTraces.length === 0 && !agentRunning && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
                    {[
                        { icon: "⚖️", text: "Check my compliance status", prompt: "Check my compliance status and verify all uploaded documents" },
                        { icon: "🔍", text: "Find grants for education", prompt: "Find CSR grants matching my NGO's focus on education in India" },
                        { icon: "📝", text: "Draft a proposal", prompt: "Generate a grant proposal for the best matching CSR opportunity" },
                    ].map(s => (
                        <button key={s.text} onClick={() => { setPrompt(s.prompt); }}
                            className="corporate-card" style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--border)", padding: "14px 16px", fontSize: 13, background: "var(--bg-card)" }}>
                            <span style={{ fontSize: 18 }}>{s.icon}</span>
                            <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>{s.text}</div>
                        </button>
                    ))}
                </div>
            )}

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                    { icon: "⚖️", value: stats.docs, label: "Documents Verified", href: "/upload" },
                    { icon: "🔍", value: stats.grants, label: "Grants Matched", href: "/grants" },
                    { icon: "📝", value: stats.proposals, label: "Proposals Generated", href: "/proposals" },
                    { icon: "📊", value: stats.score, label: "Compliance Score", href: "/upload" },
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
                {/* Compliance Overview from DynamoDB */}
                <div className="corporate-card">
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Compliance Status (from DynamoDB)</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                            { key: "certificate12A", label: "12A Certificate" },
                            { key: "certificate80G", label: "80G Certificate" },
                            { key: "certificateCSR1", label: "CSR-1 Certificate" },
                        ].map(c => (
                            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 6, background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                                {statusBadge(certStatus(c.key))}
                            </div>
                        ))}
                    </div>
                    {complianceStatus === null && !loading && (
                        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                            No profile data found. <a href="/upload" style={{ color: "var(--accent)" }}>Upload documents</a> to begin.
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="corporate-card">
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <a href="/upload" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>📤 Upload Documents</a>
                        <a href="/grants" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>🔍 Find Grants</a>
                        <a href="/proposals" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>📝 Generate Proposal</a>
                        <a href="/reports" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>📈 Generate Report</a>
                        <a href="/chatbot" className="btn-secondary" style={{ fontSize: 13, textAlign: "center" }}>💬 Ask about CSR</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
