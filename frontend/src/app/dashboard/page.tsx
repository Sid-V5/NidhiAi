"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getComplianceStatus, searchGrants, listProposals, getProfile, invokeAgent } from "@/lib/api";
import { useRouter } from "next/navigation";
import AgentTrace, { type TraceEvent } from "@/components/AgentTrace";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    traces?: TraceEvent[];
    actionLinks?: { label: string; href: string; icon: string }[];
}

/** Parse XML function-call tags from Bedrock agent completions */
function parseAgentResponse(raw: string): string {
    if (!raw) return "";
    const contentMatch = raw.match(/<__parameter=content>([\s\S]*?)(<\/__parameter>|$)/i);
    if (contentMatch) {
        return contentMatch[1].replace(/<\/?__[^>]*>/g, "").trim();
    }
    if (raw.includes("<__function=")) {
        return raw.replace(/<\/?__[^>]*>/g, "").trim() || raw;
    }
    return raw;
}

/** Detect action keywords in agent response and return relevant page links */
function detectActionLinks(text: string): { label: string; href: string; icon: string }[] {
    const links: { label: string; href: string; icon: string }[] = [];
    const lower = text.toLowerCase();
    if (lower.includes("proposal") || lower.includes("draft") || lower.includes("generated")) {
        links.push({ label: "View Proposals", href: "/proposals", icon: "📝" });
    }
    if (lower.includes("grant") || lower.includes("funding") || lower.includes("csr")) {
        links.push({ label: "View Grants", href: "/grants", icon: "🔍" });
    }
    if (lower.includes("compliance") || lower.includes("document") || lower.includes("upload") || lower.includes("12a") || lower.includes("80g")) {
        links.push({ label: "View Compliance", href: "/upload", icon: "⚖️" });
    }
    if (lower.includes("report") || lower.includes("impact")) {
        links.push({ label: "View Reports", href: "/reports", icon: "📊" });
    }
    return links;
}

export default function DashboardPage() {
    const session = getSession();
    const router = useRouter();
    const [stats, setStats] = useState({ docs: "...", grants: "...", proposals: "...", score: "..." });
    const [loading, setLoading] = useState(true);

    // Profile data (real, not hardcoded)
    const [profileSector, setProfileSector] = useState("");
    const [profileDescription, setProfileDescription] = useState("");

    // Multi-turn conversation
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [prompt, setPrompt] = useState("");
    const [agentRunning, setAgentRunning] = useState(false);
    const [currentTraces, setCurrentTraces] = useState<TraceEvent[]>([]);
    const [agentStartTime, setAgentStartTime] = useState(0);
    const [agentSessionId, setAgentSessionId] = useState<string | undefined>();
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Compliance from COMPLIANCE_TABLE (not profile)
    const [complianceResults, setComplianceResults] = useState<Array<Record<string, unknown>>>([]);

    useEffect(() => {
        if (!isProfileComplete()) {
            router.push("/profile");
            return;
        }

        async function loadDashboard() {
            // Fetch profile for real sector/description
            const profileRes = await getProfile(session.ngoId);
            let sector = "";
            let description = "";

            if (profileRes.ok && profileRes.data) {
                const profile = profileRes.data as Record<string, unknown>;
                const p = profile.profile as Record<string, unknown>;
                if (p?.sector) sector = p.sector as string;
                if (p?.description) description = p.description as string;
            }
            setProfileSector(sector);
            setProfileDescription(description);

            // Fetch stats from AWS using real profile data
            const [compRes, grantRes, propRes] = await Promise.all([
                getComplianceStatus(session.ngoId),
                searchGrants({
                    ngoSector: sector || session.ngoName || "NGO",
                    ngoDescription: description || session.ngoName || "NGO",
                    location: "India",
                }),
                listProposals(session.ngoId),
            ]);

            if (compRes.ok && compRes.data) {
                const d = compRes.data as Record<string, unknown>;
                const valid = d.validDocuments as number || 0;
                const total = d.totalDocuments as number || 3;
                const results = (d.results as Array<Record<string, unknown>>) || [];
                setComplianceResults(results);
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

            setLoading(false);
        }
        loadDashboard();
    }, [session.ngoId, session.ngoName, router]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, agentRunning]);

    // Send prompt to Supervisor Agent (multi-turn)
    const handleSubmit = useCallback(async () => {
        const text = prompt.trim();
        if (!text || agentRunning) return;

        // Add user message to history
        setMessages(prev => [...prev, { role: "user", content: text }]);
        setPrompt("");

        const now = Date.now();
        setAgentStartTime(now);
        setAgentRunning(true);
        setCurrentTraces([{
            type: "planning",
            agentName: "Supervisor",
            action: "Analyzing request and planning workflow",
            timestamp: now,
            status: "active",
        }]);

        // Build context from real profile data
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
            console.error("Failed to fetch compliance keys", e);
        }

        const supervisorAgentId = process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID || "HB82HPMIA3";
        // Use REAL profile data — no hardcoded sector
        const fullPrompt = [
            `NGO: "${session.ngoName}" (ID: ${session.ngoId})`,
            `S3 Bucket: nidhiai-documents`,
            `Documents: ${docsStr}`,
            `Sector: ${profileSector || "Not specified"} | Location: India`,
            `Description: ${profileDescription || "Not specified"}`,
            `Request: ${text}`,
        ].join("\n");

        const res = await invokeAgent(supervisorAgentId, fullPrompt, agentSessionId);

        if (res.ok && res.data) {
            const { completion, sessionId: sid, traces } = res.data;
            setAgentSessionId(sid);

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

            const parsedCompletion = parseAgentResponse(completion || "No response generated.");
            const actionLinks = detectActionLinks(parsedCompletion);

            setMessages(prev => [...prev, {
                role: "assistant",
                content: parsedCompletion,
                traces: parsedTraces,
                actionLinks,
            }]);
            setCurrentTraces([]);
        } else {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `⚠️ ${res.error || "Agent invocation failed. Please try again."}`,
            }]);
            setCurrentTraces([]);
        }

        setAgentRunning(false);
    }, [prompt, agentRunning, agentSessionId, session.ngoId, session.ngoName, profileSector, profileDescription]);

    /** Get compliance status for a doc type from COMPLIANCE_TABLE results */
    const getDocStatus = (docType: string): string => {
        const result = complianceResults.find(r => r.documentType === docType);
        if (!result) return "not_uploaded";
        return (result.status as string) || "pending";
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
        <div style={{ paddingBottom: 40 }}>
            <div className="page-header" style={{ marginBottom: 24, paddingBottom: 12 }}>
                <h1 style={{ fontSize: 28 }}>Dashboard</h1>
                <p style={{ fontSize: 14, marginTop: 4 }}>Welcome back, {session.ngoName || "Setup your profile"}. Here is your funding overview.</p>
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
                    placeholder={messages.length > 0 ? "Follow up with the Supervisor Agent..." : "Ask NidhiAI anything — verify docs, find grants, draft proposals..."}
                    disabled={agentRunning}
                />
                <button className="command-bar__send" onClick={handleSubmit} disabled={agentRunning || !prompt.trim()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>

            {/* Multi-turn Conversation History */}
            {messages.length > 0 && (
                <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                    {messages.map((msg, i) => (
                        <div key={i}>
                            {msg.role === "user" ? (
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <div style={{
                                        maxWidth: "70%", padding: "10px 16px", borderRadius: "14px 14px 4px 14px",
                                        background: "var(--accent)", color: "#fff", fontSize: 14, lineHeight: 1.6,
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {/* Agent traces for this message */}
                                    {msg.traces && msg.traces.length > 0 && (
                                        <AgentTrace
                                            traces={msg.traces}
                                            isRunning={false}
                                            startTime={msg.traces[0]?.timestamp || 0}
                                            completion={msg.content}
                                        />
                                    )}
                                    {/* If no traces, just show the completion */}
                                    {(!msg.traces || msg.traces.length === 0) && (
                                        <div style={{
                                            padding: "16px 20px", borderRadius: 12, fontSize: 14, lineHeight: 1.7,
                                            background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.2)",
                                            color: "var(--text-primary)", whiteSpace: "pre-wrap",
                                        }}>
                                            {msg.content}
                                        </div>
                                    )}
                                    {/* Action links */}
                                    {msg.actionLinks && msg.actionLinks.length > 0 && (
                                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                            {msg.actionLinks.map((link) => (
                                                <a key={link.href} href={link.href}
                                                    className="btn-secondary" style={{ fontSize: 12, padding: "6px 14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                    {link.icon} {link.label} →
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Currently running agent trace */}
                    {agentRunning && (
                        <AgentTrace
                            traces={currentTraces}
                            isRunning={true}
                            startTime={agentStartTime}
                        />
                    )}
                    <div ref={chatEndRef} />
                </div>
            )}

            {/* Agent running indicator (when no messages yet) */}
            {agentRunning && messages.length === 0 && (
                <div style={{ marginBottom: 24 }}>
                    <AgentTrace
                        traces={currentTraces}
                        isRunning={true}
                        startTime={agentStartTime}
                    />
                </div>
            )}

            {/* Sample prompts (only shown before first message) */}
            {messages.length === 0 && !agentRunning && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
                    {[
                        { icon: "🚀", text: "Full Automation — verify, match & draft", prompt: "Verify all my compliance documents, find the best matching CSR grants for my NGO, and generate a proposal for the top match" },
                        { icon: "⚖️", text: "Check my compliance status", prompt: "Check my compliance status and verify all uploaded documents" },
                        { icon: "🔍", text: "Find grants for my sector", prompt: `Find CSR grants matching my NGO's profile` },
                        { icon: "📝", text: "Draft a proposal", prompt: "Generate a grant proposal for the best matching CSR opportunity" },
                    ].map(s => (
                        <button key={s.text} onClick={() => { setPrompt(s.prompt); }}
                            className="corporate-card" style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--border)", padding: "12px 16px", fontSize: 13, background: "var(--bg-card)" }}>
                            <span style={{ fontSize: 16 }}>{s.icon}</span>
                            <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 12 }}>{s.text}</div>
                        </button>
                    ))}
                </div>
            )}

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                    { icon: "⚖️", value: stats.docs, label: "Docs Verified", href: "/upload" },
                    { icon: "🔍", value: stats.grants, label: "Grants Matched", href: "/grants" },
                    { icon: "📝", value: stats.proposals, label: "Proposals", href: "/proposals" },
                    { icon: "📊", value: stats.score, label: "Compliance", href: "/upload" },
                ].map((s) => (
                    <a key={s.label} href={s.href} className="corporate-card" style={{ textDecoration: "none", cursor: "pointer", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 20 }}>{s.icon}</span>
                            {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : null}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 28, fontWeight: 700, fontFamily: "var(--font-space-mono)", color: "var(--text-primary)" }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{s.label}</div>
                    </a>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Compliance Overview — from COMPLIANCE_TABLE */}
                <div className="corporate-card" style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Compliance Status</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { key: "12A", label: "12A Certificate" },
                            { key: "80G", label: "80G Certificate" },
                            { key: "CSR1", label: "CSR-1 Certificate" },
                        ].map(c => (
                            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</span>
                                {statusBadge(getDocStatus(c.key))}
                            </div>
                        ))}
                    </div>
                    {complianceResults.length === 0 && !loading && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                            No documents scanned. <a href="/upload" style={{ color: "var(--accent)" }}>Upload</a> to begin.
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="corporate-card" style={{ padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick Actions</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        <a href="/upload" className="btn-secondary" style={{ fontSize: 12, textAlign: "center", padding: "8px 6px" }}>📤 Upload</a>
                        <a href="/grants" className="btn-secondary" style={{ fontSize: 12, textAlign: "center", padding: "8px 6px" }}>🔍 Grants</a>
                        <a href="/proposals" className="btn-secondary" style={{ fontSize: 12, textAlign: "center", padding: "8px 6px" }}>📝 Proposals</a>
                        <a href="/reports" className="btn-secondary" style={{ fontSize: 12, textAlign: "center", padding: "8px 6px" }}>📈 Reports</a>
                        <a href="/chatbot" className="btn-secondary" style={{ fontSize: 12, textAlign: "center", padding: "8px 6px", gridColumn: "span 2" }}>💬 CSR Assistant</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
