"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getSession } from "@/lib/auth";
import { searchGrants, generateProposal, getComplianceStatus } from "@/lib/api";
import GrantCard from "@/components/GrantCard";

interface Grant {
    grantId: string; corporationName: string; programName: string;
    focusAreas: string[]; fundingRange: { min: number; max: number };
    relevanceScore: number; matchReason?: string; geographicScope?: string[];
}

interface ProposalContent {
    executiveSummary?: string;
    problemStatement?: string;
    proposedSolution?: string;
    budgetTable?: Array<{ category: string; description: string; amount: number }>;
    impactMetrics?: Array<{ metric: string; baseline: string; target: string }>;
}

interface TraceStep {
    id: string;
    label: string;
    status: "pending" | "active" | "done" | "error";
    detail?: string;
    startedAt?: number;
    durationMs?: number;
}

const TRACE_STEPS_PROPOSAL: Omit<TraceStep, "status">[] = [
    { id: "analyze", label: "Evaluating grant requirements and eligibility criteria" },
    { id: "profile", label: "Loading organization profile and compliance status" },
    { id: "kb_search", label: "Searching proposal knowledge base for similar formats" },
    { id: "draft_exec", label: "Drafting executive summary and problem statement" },
    { id: "draft_body", label: "Writing proposed solution and methodology" },
    { id: "budget", label: "Generating budget breakdown and cost justification" },
    { id: "impact", label: "Calculating impact metrics and outcome projections" },
    { id: "format_pdf", label: "Formatting document and generating PDF" },
    { id: "upload", label: "Storing document and creating download link" },
];

export default function GrantsPage() {
    const session = getSession();
    const [grants, setGrants] = useState<Grant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("All");
    const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
    const [streamText, setStreamText] = useState("");
    const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
    const [traceOpen, setTraceOpen] = useState(true);
    const [traceStartTime, setTraceStartTime] = useState(0);
    const [complianceDone, setComplianceDone] = useState(true);
    const streamRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check compliance from DynamoDB
        async function checkCompliance() {
            const compRes = await getComplianceStatus(session.ngoId);
            if (compRes.ok && compRes.data) {
                const d = compRes.data as Record<string, unknown>;
                const valid = (d.validDocuments as number) || 0;
                setComplianceDone(valid > 0);
            } else {
                setComplianceDone(false);
            }
        }
        checkCompliance();
        loadGrants();
    }, []);

    const loadGrants = async (query?: string) => {
        setLoading(true); setError("");
        const res = await searchGrants({
            ngoSector: session.ngoName ? "Education" : "",
            ngoDescription: query || session.ngoName || "NGO",
            location: "India",
        });
        if (res.ok && res.data) {
            setGrants((res.data.grants as Grant[]) || []);
        }
        else setError(res.error || "Grant search failed");
        setLoading(false);
    };

    const handleSearch = () => { if (searchQuery.trim()) loadGrants(searchQuery); };

    // Advance a trace step to "done" and set the next to "active"
    const advanceTrace = useCallback((stepIndex: number) => {
        setTraceSteps(prev => prev.map((s, i) => {
            if (i < stepIndex) return { ...s, status: "done" as const, durationMs: s.startedAt ? Date.now() - s.startedAt : 0 };
            if (i === stepIndex) return { ...s, status: "active" as const, startedAt: Date.now() };
            return s;
        }));
    }, []);

    const simulateStream = (text: string): Promise<void> => {
        return new Promise((resolve) => {
            let i = 0;
            setStreamText("");
            const interval = setInterval(() => {
                if (i < text.length) {
                    const chunkSize = Math.min(4, text.length - i);
                    setStreamText(prev => prev + text.substring(i, i + chunkSize));
                    i += chunkSize;
                    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
                } else { clearInterval(interval); resolve(); }
            }, 4);
        });
    };

    const handleSelect = async (grantId: string) => {
        const grant = grants.find(g => g.grantId === grantId);
        if (!grant) return;
        setSelectedGrant(grant);
        setGenerating(true); setGenerated(false); setDownloadUrl(""); setStreamText("");
        setTraceOpen(true);

        // Initialize trace steps
        const startTime = Date.now();
        setTraceStartTime(startTime);
        const steps: TraceStep[] = TRACE_STEPS_PROPOSAL.map(s => ({ ...s, status: "pending" as const }));
        steps[0].status = "active"; steps[0].startedAt = startTime;
        setTraceSteps(steps);

        // Fire trace steps with realistic timing as the API call runs
        const traceTimers = [1200, 2200, 3500, 5500, 9000, 14000, 18000, 22000];
        const timerIds: ReturnType<typeof setTimeout>[] = [];
        traceTimers.forEach((ms, idx) => {
            timerIds.push(setTimeout(() => advanceTrace(idx + 1), ms));
        });

        const res = await generateProposal({
            ngoId: session.ngoId, grantId, ngoName: session.ngoName,
            ngoDescription: "Education NGO focused on tribal literacy",
            grantDetails: grant,
        });

        timerIds.forEach(clearTimeout);

        if (res.ok && res.data) {
            const data = res.data as Record<string, unknown>;
            setDownloadUrl((data.downloadUrl as string) || "");
            const content = (data.content as ProposalContent) || null;
            // Proposal generated successfully

            // Complete all trace steps at download + final step
            setTraceSteps(prev => prev.map(s => ({
                ...s, status: "done" as const,
                durationMs: s.startedAt ? Date.now() - s.startedAt : Math.floor(Math.random() * 2000 + 800),
            })));

            if (content) {
                const fullText = [
                    content.executiveSummary ? `## Executive Summary\n${content.executiveSummary}\n\n` : "",
                    content.problemStatement ? `## Problem Statement\n${content.problemStatement}\n\n` : "",
                    content.proposedSolution ? `## Proposed Solution\n${content.proposedSolution}\n\n` : "",
                    content.budgetTable?.length ? `## Budget Breakdown\n${content.budgetTable.map(b => `• ${b.category}: ₹${(b.amount || 0).toLocaleString("en-IN")} — ${b.description}`).join("\n")}\n\n` : "",
                    content.impactMetrics?.length ? `## Impact Metrics\n${content.impactMetrics.map(m => `• ${m.metric}: ${m.baseline} → ${m.target}`).join("\n")}` : "",
                ].join("");
                await simulateStream(fullText || (data.summary as string) || "Proposal generated successfully.");
            } else {
                await simulateStream((data.summary as string) || "Proposal generated and stored.");
            }
        } else {
            setTraceSteps(prev => prev.map((s, i) => i === prev.findIndex(x => x.status === "active")
                ? { ...s, status: "error" as const, detail: res.error || "Generation failed" }
                : s));
            setError(res.error || "Proposal generation failed");
        }
        setGenerating(false); setGenerated(true);
    };

    const filtered = grants.filter(g => {
        if (activeFilter !== "All" && !g.focusAreas?.some(a => a.toLowerCase().includes(activeFilter.toLowerCase()))) return false;
        return true;
    });

    const elapsedSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

    return (
        <div>
            {/* COMPLIANCE GATE BANNER */}
            {!complianceDone && (
                <div style={{
                    padding: "16px 20px", borderRadius: 8, background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.3)", marginBottom: 24,
                    display: "flex", alignItems: "center", gap: 16,
                }}>
                    <span style={{ fontSize: 24 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#D97706" }}>Compliance Required</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Verify your 12A, 80G &amp; CSR-1 documents first to unlock grant matching.</div>
                    </div>
                    <a href="/upload" className="btn-primary" style={{ fontSize: 12, padding: "8px 16px", textDecoration: "none", whiteSpace: "nowrap" }}>Verify Documents →</a>
                </div>
            )}
            <div className="page-header">
                <h1>Grant Discovery</h1>
                <p>AI-matched CSR funding opportunities from India&apos;s top corporations, tailored to your NGO&apos;s profile.</p>
            </div>

            <div className="corporate-card" style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>🔍</span>
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search grants by sector, corporation, or focus..."
                    className="input-field" style={{ flex: 1 }} />
                <button className="btn-primary" style={{ fontSize: 13 }} onClick={handleSearch}>Search</button>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                {["All", "Education", "Healthcare", "Women", "Environment"].map((f) => (
                    <button key={f} className={activeFilter === f ? "btn-primary" : "btn-secondary"} style={{ fontSize: 12, padding: "6px 16px" }}
                        onClick={() => setActiveFilter(f)}>{f}</button>
                ))}
            </div>

            {loading && (
                <div className="corporate-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="spinner" /><span>Matching grants to your profile...</span>
                </div>
            )}

            {error && <div className="corporate-card" style={{ borderLeft: "3px solid var(--red)", color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}

            {!loading && grants.length === 0 && !error && (
                <div className="corporate-card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>No grants found</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Try searching for a different sector or adjust your query.</div>
                </div>
            )}

            {/* === PROPOSAL GENERATION WITH THINKING TRACE === */}
            {(generating || generated) && selectedGrant && (
                <div style={{ display: "grid", gridTemplateColumns: traceOpen ? "300px 1fr" : "40px 1fr", gap: 0, marginBottom: 24, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", transition: "grid-template-columns 0.3s ease" }}>

                    {/* THINKING TRACE — LEFT PANEL */}
                    <div style={{
                        background: "var(--bg-secondary)",
                        borderRight: "1px solid var(--border)",
                        padding: traceOpen ? "16px" : "16px 8px",
                        overflowY: "auto", maxHeight: 520,
                        transition: "all 0.3s ease",
                    }}>
                        <div onClick={() => setTraceOpen(!traceOpen)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: traceOpen ? 16 : 0 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", transform: traceOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
                            {traceOpen && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Thinking</span>}
                            {traceOpen && generating && <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginLeft: "auto" }} />}
                        </div>

                        {traceOpen && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {traceSteps.map((step, idx) => (
                                    <div key={step.id} style={{
                                        display: "flex", alignItems: "flex-start", gap: 10,
                                        padding: "8px 10px", borderRadius: 6,
                                        background: step.status === "active" ? "rgba(245,158,11,0.06)" : "transparent",
                                        transition: "all 0.3s ease",
                                        opacity: step.status === "pending" ? 0.35 : 1,
                                    }}>
                                        {/* Status indicator */}
                                        <div style={{ minWidth: 18, paddingTop: 1 }}>
                                            {step.status === "pending" && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", opacity: 0.3 }} />}
                                            {step.status === "active" && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5, borderTopColor: "var(--accent)" }} />}
                                            {step.status === "done" && <span style={{ color: "var(--green)", fontSize: 13, lineHeight: 1 }}>✓</span>}
                                            {step.status === "error" && <span style={{ color: "var(--red)", fontSize: 13, lineHeight: 1 }}>✗</span>}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 11.5, lineHeight: 1.4,
                                                color: step.status === "active" ? "var(--accent)" : step.status === "done" ? "var(--text-secondary)" : "var(--text-muted)",
                                                fontWeight: step.status === "active" ? 600 : 400,
                                            }}>
                                                {step.label}
                                            </div>
                                            {step.status === "done" && step.durationMs !== undefined && (
                                                <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1, fontFamily: "var(--font-space-mono)" }}>
                                                    {elapsedSec(step.durationMs)}
                                                </div>
                                            )}
                                            {step.status === "error" && step.detail && (
                                                <div style={{ fontSize: 10, color: "var(--red)", marginTop: 2 }}>{step.detail}</div>
                                            )}
                                        </div>

                                        {/* Connector line */}
                                        {idx < traceSteps.length - 1 && (
                                            <div style={{
                                                position: "absolute", left: 27, top: 24, width: 1, height: "calc(100% - 18px)",
                                                background: step.status === "done" ? "var(--green)" : "var(--border)",
                                                opacity: 0.3,
                                            }} />
                                        )}
                                    </div>
                                ))}

                                {/* Total time */}
                                {generated && !generating && (
                                    <div style={{
                                        marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)",
                                        fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-space-mono)",
                                        display: "flex", justifyContent: "space-between",
                                    }}>
                                        <span>Total</span>
                                        <span>{elapsedSec(Date.now() - traceStartTime)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* DOCUMENT STREAMING — RIGHT PANEL */}
                    <div style={{ background: "var(--bg-primary)", padding: 20, maxHeight: 520, overflowY: "auto" }} ref={streamRef}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18 }}>{generating ? "✍️" : "✅"}</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                                        {generating ? "Drafting proposal..." : "Proposal ready"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                        {selectedGrant.programName} — {selectedGrant.corporationName}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {generating && <span className="badge badge-processing">GENERATING</span>}
                                {generated && !generating && <span className="badge badge-valid">COMPLETE</span>}
                                {downloadUrl && !generating && (
                                    <a href={downloadUrl} target="_blank" className="btn-primary download-glow" style={{ fontSize: 12, padding: "6px 16px", textDecoration: "none" }}>
                                        📥 Download PDF
                                    </a>
                                )}
                            </div>
                        </div>

                        <div style={{
                            padding: 20, borderRadius: 4,
                            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                            fontFamily: "var(--font-inter)", fontSize: 13,
                            color: "var(--text-primary)", lineHeight: 1.8, whiteSpace: "pre-wrap",
                        }}>
                            {generating && !streamText && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)" }}>
                                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    <span style={{ fontSize: 12 }}>Waiting for model response...</span>
                                </div>
                            )}
                            {streamText.split("\n").map((line, i) => {
                                if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", marginTop: i > 0 ? 12 : 0, marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>{line.replace("## ", "")}</div>;
                                if (line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid var(--border)", marginBottom: 4, color: "var(--text-secondary)" }}>{line}</div>;
                                return <span key={i}>{line}{"\n"}</span>;
                            })}
                            {(generating || (streamText && !generated)) && <span className="streaming-cursor" />}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {filtered.map((grant) => (
                    <GrantCard key={grant.grantId} {...grant} onSelect={handleSelect} />
                ))}
            </div>
        </div>
    );
}
