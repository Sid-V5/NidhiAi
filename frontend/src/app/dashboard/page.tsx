"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getComplianceStatus, searchGrants, listProposals, getProfile, invokeAgent, generateProposal, generateReport } from "@/lib/api";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
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
    // Removed Compliance action link per user request
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

    // Detect requested actions from prompt
    function parsePromptActions(text: string) {
        const lower = text.toLowerCase();
        const hasVerify = /verif|compliance|check.*doc|scan/i.test(lower);
        const hasGrant = /grant|fund|csr|match/i.test(lower);
        const hasProposal = /proposal|draft|generat/i.test(lower);
        const hasReport = /report|impact/i.test(lower);
        return { hasVerify, hasGrant, hasProposal, hasReport };
    }

    // Dynamic Client-Side Chain: runs requested combinations of Compliance → Grants → Proposal → Report
    const runClientChain = useCallback(async (actions: { hasVerify: boolean, hasGrant: boolean, hasProposal: boolean, hasReport: boolean }) => {
        const { hasVerify, hasGrant, hasProposal, hasReport } = actions;
        const now = Date.now();
        const traces: TraceEvent[] = [];
        const addTrace = (t: TraceEvent) => {
            traces.push(t);
            setCurrentTraces([...traces]);
        };

        const flowName = [
            hasVerify && "Verify",
            hasGrant && "Search Grants",
            hasProposal && "Generate Proposal",
            hasReport && "Generate Impact Report"
        ].filter(Boolean).join(" → ");

        addTrace({ type: "planning", agentName: "Supervisor", action: `Planning workflow: ${flowName}`, timestamp: now, status: "done" });

        let complianceSummary = "";
        let grantSummary = "";
        let proposalSummary = "";
        let topGrant: Record<string, unknown> | null = null;
        let downloadUrl = "";

        // ── Step 1: Compliance (if requested) ──
        if (hasVerify) {
            addTrace({ type: "agent_invocation", agentName: "Compliance", action: "Scanning uploaded documents...", timestamp: Date.now(), status: "active" });
            try {
                const compRes = await getComplianceStatus(session.ngoId);
                if (compRes.ok && compRes.data) {
                    const d = compRes.data as Record<string, unknown>;
                    const valid = d.validDocuments as number || 0;
                    const total = d.totalDocuments as number || 3;
                    const results = (d.results as Array<Record<string, unknown>>) || [];
                    const docNames = results.map(r => `${r.documentType}: ${r.status === "VALID" || r.complianceResult ? "✅" : "⚠️"}`).join(", ");
                    complianceSummary = `${valid}/${total} documents verified (${docNames})`;
                    setComplianceResults(results);
                    setStats(prev => ({ ...prev, docs: `${valid}/${total}`, score: `${Math.round((valid / total) * 100)}%` }));
                } else {
                    complianceSummary = "Could not retrieve compliance status";
                }
            } catch { complianceSummary = "Compliance check encountered an error"; }
            traces[traces.length - 1] = { ...traces[traces.length - 1], status: "done", observation: complianceSummary, durationMs: Date.now() - (traces[traces.length - 1].timestamp || Date.now()) };
            setCurrentTraces([...traces]);
        }

        // ── Step 2: Grant Search (if requested or strongly implied by proposal) ──
        if (hasGrant || hasProposal) {
            const grantStart = Date.now();
            addTrace({ type: "agent_invocation", agentName: "Grant Scout", action: "Searching CSR grants matching your profile...", timestamp: grantStart, status: "active" });
            try {
                const grantRes = await searchGrants({
                    ngoSector: profileSector || "Education",
                    ngoDescription: profileDescription || session.ngoName || "NGO",
                    location: "India",
                });
                if (grantRes.ok && grantRes.data) {
                    const grants = grantRes.data.grants || [];
                    setStats(prev => ({ ...prev, grants: String(grants.length) }));
                    if (grants.length > 0) {
                        topGrant = grants[0] as Record<string, unknown>;
                        const grantName = (topGrant.programName || topGrant.grantTitle || "CSR Grant") as string;
                        const corp = (topGrant.corporationName || topGrant.corporation || "") as string;
                        grantSummary = `Found ${grants.length} grants. Top match: "${grantName}" by ${corp}`;
                    } else {
                        grantSummary = "No matching grants found";
                    }
                } else {
                    grantSummary = "Grant search returned no results";
                }
            } catch { grantSummary = "Grant search encountered an error"; }
            traces[traces.length - 1] = { ...traces[traces.length - 1], status: "done", observation: grantSummary, durationMs: Date.now() - grantStart };
            setCurrentTraces([...traces]);
        }

        // ── Step 3: Proposal Generation (if requested) ──
        if (hasProposal) {
            if (topGrant) {
                const propStart = Date.now();
                addTrace({ type: "agent_invocation", agentName: "Proposal Writer", action: `Generating proposal for "${(topGrant.programName || topGrant.grantTitle || "Grant") as string}"...`, timestamp: propStart, status: "active" });
                try {
                    const propRes = await generateProposal({
                        ngoId: session.ngoId,
                        grantId: (topGrant.grantId || topGrant.id || "grant-001") as string,
                        ngoName: session.ngoName,
                        ngoDescription: profileDescription || session.ngoName,
                        grantDetails: topGrant,
                    });
                    if (propRes.ok && propRes.data) {
                        downloadUrl = propRes.data.downloadUrl || "";
                        proposalSummary = `Proposal generated successfully!${downloadUrl ? " PDF ready for download." : ""}`;
                        // Refresh proposals count
                        const propList = await listProposals(session.ngoId);
                        if (propList.ok && propList.data) setStats(prev => ({ ...prev, proposals: String(propList.data!.proposals.length) }));
                    } else {
                        proposalSummary = "Proposal generation failed: " + (propRes.error || "Unknown error");
                    }
                } catch { proposalSummary = "Proposal generation encountered an error"; }
                traces[traces.length - 1] = { ...traces[traces.length - 1], status: "done", observation: proposalSummary, durationMs: Date.now() - (traces[traces.length - 1].timestamp || Date.now()) };
                setCurrentTraces([...traces]);
            } else {
                proposalSummary = "Skipped — no matching grants found to draft a proposal for.";
            }
        }

        // ── Step 4: Impact Report Generation (if requested) ──
        let reportSummary = "";
        let reportUrl = "";
        if (hasReport) {
            const repStart = Date.now();
            addTrace({ type: "agent_invocation", agentName: "Impact Reporter", action: `Generating impact report for recent activities...`, timestamp: repStart, status: "active" });
            try {
                // Determine current quarter
                const date = new Date();
                const q = Math.floor(date.getMonth() / 3) + 1;
                const quarter = `Q${q} ${date.getFullYear()}`;

                // Call generate report (dummy activity data for now - could be pulled from profile)
                const repRes = await generateReport(session.ngoId, quarter, [
                    { date: "2024-01-15", description: "Conducted community workshop on digital literacy", beneficiaries: 150, location: "Village Center" },
                    { date: "2024-02-10", description: "Distributed educational kits to local schools", beneficiaries: 300, location: "Primary School A" }
                ]);

                if (repRes.ok && repRes.data) {
                    const data = repRes.data as { reportId?: string; downloadUrl?: string };
                    reportUrl = data.downloadUrl || "";
                    reportSummary = `Impact Report for ${quarter} generated successfully!`;
                } else {
                    reportSummary = "Report generation failed: " + (repRes.error || "Unknown error");
                }
            } catch { reportSummary = "Report generation encountered an error"; }
            traces[traces.length - 1] = { ...traces[traces.length - 1], status: "done", observation: reportSummary, durationMs: Date.now() - (traces[traces.length - 1].timestamp || Date.now()) };
            setCurrentTraces([...traces]);
        }

        addTrace({ type: "completion", agentName: "Supervisor", action: "Workflow complete", timestamp: Date.now(), status: "done", durationMs: Date.now() - now });

        // Build final response
        let response = `## ✅ Workflow Complete\n\n`;
        if (hasVerify) response += `### 1. Compliance Verification\n${complianceSummary}\n\n`;
        if (hasGrant || hasProposal) {
            response += `### ${hasVerify ? '2' : '1'}. Grant Matching\n${grantSummary}\n\n`;
        }
        if (hasProposal && topGrant) {
            const stepNum = hasVerify ? '3' : '2';
            const gName = (topGrant.programName || topGrant.grantTitle || "Grant") as string;
            const gCorp = (topGrant.corporationName || topGrant.corporation || "") as string;
            let gAmt = topGrant.amount as string || "";
            if (topGrant.fundingRange && typeof topGrant.fundingRange === 'object') {
                const range = topGrant.fundingRange as { min?: number, max?: number };
                if (range.min && range.max) {
                    gAmt = `₹${range.min.toLocaleString('en-IN')} - ₹${range.max.toLocaleString('en-IN')}`;
                } else if (range.min) {
                    gAmt = `₹${range.min.toLocaleString('en-IN')}+`;
                } else if (range.max) {
                    gAmt = `Up to ₹${range.max.toLocaleString('en-IN')}`;
                }
            }
            response += `### ${stepNum}. Proposal Generation\n${proposalSummary}\n`;
            response += `- **Grant:** ${gName}\n- **Corporation:** ${gCorp}\n`;
            if (gAmt) response += `- **Funding:** ${gAmt}\n`;
            if (downloadUrl) response += `\n📥 **[Download Proposal PDF](${downloadUrl})**\n`;
        } else if (hasProposal) {
            const stepNum = hasVerify ? '3' : '2';
            response += `### ${stepNum}. Proposal Generation\n${proposalSummary}\n`;
        }

        if (hasReport) {
            const stepNum = (hasVerify ? 1 : 0) + (hasGrant || hasProposal ? 1 : 0) + (hasProposal ? 1 : 0) + 1;
            response += `### ${stepNum}. Impact Report\n${reportSummary}\n`;
            if (reportUrl) response += `\n📥 **[Download Impact Report PDF](${reportUrl})**\n`;
        }

        const actionLinks = detectActionLinks(response);
        setMessages(prev => [...prev, { role: "assistant", content: response, traces: [...traces], actionLinks }]);
        setCurrentTraces([]);
    }, [session.ngoId, session.ngoName, profileSector, profileDescription]);

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

        const actions = parsePromptActions(text);
        // If the prompt is asking for specific actions (not general Q&A / reports), handle client-side
        if (!actions.hasReport && (actions.hasVerify || actions.hasGrant || actions.hasProposal)) {
            setCurrentTraces([{
                type: "planning",
                agentName: "Supervisor",
                action: "Workflow detected — routing directly to requested internal agents",
                timestamp: now,
                status: "active",
            }]);
            await runClientChain(actions);
            setAgentRunning(false);
            return;
        }

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
    }, [prompt, agentRunning, agentSessionId, session.ngoId, session.ngoName, profileSector, profileDescription, runClientChain]);

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
                                            <ReactMarkdown
                                                components={{
                                                    h4({ ...props }) {
                                                        return <h4 style={{ fontSize: 13, marginTop: 12, marginBottom: 8, color: "var(--text-primary)" }} {...props} />;
                                                    },
                                                    p({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLParagraphElement>) {
                                                        return <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8, color: "var(--text-secondary)" }} {...props}>{children}</p>;
                                                    },
                                                    a({ href, children, ...props }: { href?: string, children?: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
                                                        const isPdf = href?.includes('.pdf') || typeof children === 'string' && children.toLowerCase().includes('download');
                                                        if (isPdf) {
                                                            return (
                                                                <a href={href} target="_blank" rel="noopener noreferrer"
                                                                    style={{
                                                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                                        background: 'var(--primary)', color: 'white',
                                                                        padding: '8px 16px', borderRadius: '6px',
                                                                        textDecoration: 'none', fontWeight: 500,
                                                                        fontSize: '13px', marginTop: '8px', marginBottom: '8px',
                                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                    }} {...props}>
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                    </svg>
                                                                    {children}
                                                                </a>
                                                            );
                                                        }
                                                        return <a href={href} style={{ color: "var(--primary)", textDecoration: "none" }} {...props}>{children}</a>;
                                                    },
                                                    ul({ ...props }) {
                                                        return <ul style={{ listStyleType: "disc", paddingLeft: 20, marginBottom: 8 }} {...props} />;
                                                    },
                                                    li({ children, ...props }: { children?: React.ReactNode } & React.LiHTMLAttributes<HTMLLIElement>) {
                                                        return <li style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }} {...props}>{children}</li>;
                                                    },
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
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
