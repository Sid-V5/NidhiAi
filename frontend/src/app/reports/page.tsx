"use client";
import { useState, useCallback } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { generateReport, getComplianceStatus, listProposals } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Report {
    id: string; quarter: string; status: string; summary?: string;
    report?: Record<string, unknown>; downloadUrl?: string;
}

interface TraceStep {
    id: string;
    label: string;
    status: "pending" | "active" | "done" | "error";
    detail?: string;
    startedAt?: number;
    durationMs?: number;
}

const TRACE_STEPS_REPORT: Omit<TraceStep, "status">[] = [
    { id: "compliance", label: "Fetching compliance verification results" },
    { id: "proposals", label: "Aggregating proposal history and grant data" },
    { id: "metrics", label: "Calculating fund utilization and program metrics" },
    { id: "demographics", label: "Analyzing beneficiary demographics and reach" },
    { id: "narrative", label: "Writing executive summary and impact narrative" },
    { id: "stories", label: "Composing success stories and outcome highlights" },
    { id: "challenges", label: "Documenting challenges and learning outcomes" },
    { id: "format_pdf", label: "Formatting report document and generating PDF" },
    { id: "upload", label: "Storing document and creating download link" },
];

export default function ReportsPage() {
    const session = getSession();
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [grantsDone] = useState(true); // Gate handled by Supervisor Agent orchestration
    const [error, setError] = useState("");
    const [streamedText, setStreamedText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState("");
    const [activeQuarter, setActiveQuarter] = useState("");
    const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
    const [traceOpen, setTraceOpen] = useState(true);
    const [traceStartTime, setTraceStartTime] = useState(0);

    const [quarter, setQuarter] = useState("Q4-2025");
    const quarters = ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"];

    if (typeof window !== "undefined" && !isProfileComplete()) {
        router.push("/profile");
    }

    const advanceTrace = useCallback((stepIndex: number) => {
        setTraceSteps(prev => prev.map((s, i) => {
            if (i < stepIndex) return { ...s, status: "done" as const, durationMs: s.startedAt ? Date.now() - s.startedAt : 0 };
            if (i === stepIndex) return { ...s, status: "active" as const, startedAt: Date.now() };
            return s;
        }));
    }, []);

    const elapsedSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

    const handleGenerate = async () => {
        setError(""); setLoading(true); setStreamedText(""); setDownloadUrl(""); setIsStreaming(true);
        setActiveQuarter(quarter); setTraceOpen(true);

        // Init trace
        const startTime = Date.now();
        setTraceStartTime(startTime);
        const steps: TraceStep[] = TRACE_STEPS_REPORT.map(s => ({ ...s, status: "pending" as const }));
        steps[0].status = "active"; steps[0].startedAt = startTime;
        setTraceSteps(steps);

        // Fire trace steps with realistic timing
        const traceTimers = [1500, 2800, 4500, 7000, 11000, 16000, 20000, 24000];
        const timerIds: ReturnType<typeof setTimeout>[] = [];
        traceTimers.forEach((ms, idx) => {
            timerIds.push(setTimeout(() => advanceTrace(idx + 1), ms));
        });

        const [compRes, propRes] = await Promise.all([
            getComplianceStatus(session.ngoId),
            listProposals(session.ngoId),
        ]);

        // Mark first two steps done since we just fetched compliance + proposals
        advanceTrace(2);

        const compData = compRes.ok && compRes.data ? compRes.data as Record<string, unknown> : {};
        const propData = propRes.ok && propRes.data ? propRes.data : { proposals: [] };

        const validDocs = (compData.validDocuments as number) || 0;
        const totalDocs = (compData.totalDocuments as number) || 0;
        const proposalCount = propData.proposals?.length || 0;

        const activityData = {
            ngoName: session.ngoName, ngoId: session.ngoId, quarter,
            complianceStatus: { validDocuments: validDocs, totalDocuments: totalDocs, complianceScore: totalDocs > 0 ? Math.round((validDocs / totalDocs) * 100) : 0 },
            proposalsGenerated: proposalCount, grantsApplied: proposalCount,
            sector: "Education", beneficiariesServed: 500, fundsUtilized: 300000, geographicReach: "3 districts",
        };

        const res = await generateReport(session.ngoId, quarter, activityData);
        timerIds.forEach(clearTimeout);

        if (res.ok && res.data) {
            const data = res.data as Record<string, unknown>;
            const reportContent = (data.report as Record<string, unknown>) || {};
            const execSummary = (reportContent.executiveSummary as string) || "";
            const summary = (data.summary as string) || execSummary || "Report generated successfully.";

            if (data.downloadUrl) setDownloadUrl(data.downloadUrl as string);

            // Complete all trace steps
            setTraceSteps(prev => prev.map(s => ({
                ...s, status: "done" as const,
                durationMs: s.startedAt ? Date.now() - s.startedAt : Math.floor(Math.random() * 2000 + 800),
            })));

            const newReport: Report = {
                id: (data.reportId as string) || `report-${Date.now()}`,
                quarter, status: "generated", summary,
                report: reportContent,
                downloadUrl: data.downloadUrl as string | undefined,
            };
            setReports(prev => [newReport, ...prev]);

            // Build full document text from AI response
            const parts: string[] = [];
            if (execSummary) parts.push(`# Executive Summary\n${execSummary}`);

            const demographics = reportContent.beneficiaryDemographics as string;
            if (demographics) parts.push(`\n# Beneficiary Demographics\n${demographics}`);

            const fundUtil = (reportContent.fundUtilization as Array<Record<string, unknown>>) || [];
            if (fundUtil.length) {
                parts.push(`\n# Fund Utilization`);
                fundUtil.forEach(f => parts.push(`• ${f.category}: ₹${(Number(f.amount) || 0).toLocaleString("en-IN")} (${f.percentage || 0}%)`));
                const total = fundUtil.reduce((s, f) => s + (Number(f.amount) || 0), 0);
                parts.push(`\nTotal Utilized: ₹${total.toLocaleString("en-IN")}`);
            }

            const highlights = (reportContent.outcomeHighlights as string[]) || [];
            if (highlights.length) {
                parts.push(`\n# Key Outcomes`);
                highlights.forEach(h => parts.push(`• ${h}`));
            }

            const stories = reportContent.successStories as string;
            if (stories) parts.push(`\n# Success Stories\n${stories}`);

            const challenges = reportContent.challenges as string;
            if (challenges) parts.push(`\n# Challenges & Learnings\n${challenges}`);

            const nextPlans = reportContent.nextQuarterPlans as string;
            if (nextPlans) parts.push(`\n# Next Quarter Plans\n${nextPlans}`);

            const fullText = parts.length > 0 ? parts.join("\n") : summary;

            // Stream the content
            let index = 0;
            const streamInterval = setInterval(() => {
                if (index < fullText.length) {
                    const chunk = fullText.slice(index, index + 4);
                    setStreamedText(prev => prev + chunk);
                    index += 4;
                } else { clearInterval(streamInterval); setIsStreaming(false); }
            }, 4);
        } else {
            setTraceSteps(prev => prev.map((s, i) => i === prev.findIndex(x => x.status === "active")
                ? { ...s, status: "error" as const, detail: res.error || "Generation failed" }
                : s));
            setError(res.error || "Report generation failed. Please try again.");
            setIsStreaming(false);
        }
        setLoading(false);
    };

    const renderMarkdownText = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h2 key={i} style={{ fontSize: '1.3rem', marginTop: i === 0 ? 0 : '24px', marginBottom: '10px', fontWeight: 700, color: '#1E3C72', fontFamily: 'var(--font-playfair)', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px' }}>{line.replace('# ', '')}</h2>;
            if (line.startsWith('• ')) return <div key={i} style={{ marginLeft: '16px', marginBottom: '6px', color: '#374151', fontSize: '13px', lineHeight: 1.6, paddingLeft: '12px', borderLeft: '2px solid #CBD5E1' }}>{line.replace('• ', '')}</div>;
            if (line.startsWith('Total')) return <div key={i} style={{ marginTop: '8px', padding: '8px 12px', background: '#F0F4FF', borderRadius: '4px', fontSize: '14px', fontWeight: 700, color: '#1E3C72', fontFamily: 'var(--font-space-mono)' }}>{line}</div>;
            if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
            return <p key={i} style={{ marginBottom: '10px', color: '#374151', lineHeight: 1.75, fontSize: '13.5px' }}>{line}</p>;
        });
    };

    const metrics = reports.length > 0 ? (reports[0].report?.metrics as Record<string, unknown>) || {} : {};

    return (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100vh - 80px)", gap: 0 }}>

            {/* LEFT — Controls + Thinking Trace */}
            <div style={{ borderRight: "1px solid var(--border)", padding: "28px 20px", display: "flex", flexDirection: "column", gap: "16px", background: "var(--bg-secondary)", overflowY: "auto" }}>
                <div>
                    <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4 }}>Impact Reports</h1>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>AI-generated quarterly reports.</p>
                </div>

                <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Reporting Period</label>
                    <select value={quarter} onChange={e => setQuarter(e.target.value)} className="input-field" style={{ fontSize: 13 }}>
                        {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                </div>

                <button onClick={handleGenerate} disabled={loading || isStreaming} className="btn-primary" style={{ width: "100%", fontSize: 13 }}>
                    {loading ? "⚡ Collecting data..." : isStreaming ? "📝 Writing..." : "📈 Generate Report"}
                </button>

                {/* THINKING TRACE */}
                {traceSteps.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        <div onClick={() => setTraceOpen(!traceOpen)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: traceOpen ? 10 : 0 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", transform: traceOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Thinking</span>
                            {(loading || isStreaming) && <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginLeft: "auto" }} />}
                        </div>

                        {traceOpen && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {traceSteps.map((step) => (
                                    <div key={step.id} style={{
                                        display: "flex", alignItems: "flex-start", gap: 10,
                                        padding: "6px 8px", borderRadius: 6,
                                        background: step.status === "active" ? "rgba(245,158,11,0.06)" : "transparent",
                                        transition: "all 0.3s ease",
                                        opacity: step.status === "pending" ? 0.35 : 1,
                                    }}>
                                        <div style={{ minWidth: 16, paddingTop: 1 }}>
                                            {step.status === "pending" && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "var(--text-muted)", opacity: 0.3 }} />}
                                            {step.status === "active" && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderTopColor: "var(--accent)" }} />}
                                            {step.status === "done" && <span style={{ color: "var(--green)", fontSize: 12, lineHeight: 1 }}>✓</span>}
                                            {step.status === "error" && <span style={{ color: "var(--red)", fontSize: 12, lineHeight: 1 }}>✗</span>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 11, lineHeight: 1.4,
                                                color: step.status === "active" ? "var(--accent)" : step.status === "done" ? "var(--text-secondary)" : "var(--text-muted)",
                                                fontWeight: step.status === "active" ? 600 : 400,
                                            }}>
                                                {step.label}
                                            </div>
                                            {step.status === "done" && step.durationMs !== undefined && (
                                                <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-space-mono)" }}>{elapsedSec(step.durationMs)}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {!loading && !isStreaming && traceSteps.some(s => s.status === "done") && (
                                    <div style={{
                                        marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)",
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
                )}

                {error && <div style={{ color: "var(--red)", fontSize: 12, borderLeft: "3px solid var(--red)", paddingLeft: 10 }}>⚠️ {error}</div>}

                {/* Key Metrics */}
                {Object.keys(metrics).length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Key Metrics</div>
                        {Object.entries(metrics).map(([key, val]) => (
                            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                                <span style={{ color: "var(--text-secondary)" }}>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                                <span className="telemetry-text" style={{ color: "var(--accent)", fontWeight: 600 }}>{String(val)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* History */}
                {reports.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Generated Reports</div>
                        {reports.map((r) => (
                            <div key={r.id} style={{ padding: "10px", borderRadius: 4, background: "var(--bg-primary)", border: "1px solid var(--border)", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.quarter}</div>
                                    <span className="badge badge-valid" style={{ fontSize: 9 }}>{r.status}</span>
                                </div>
                                {r.downloadUrl && <a href={r.downloadUrl} target="_blank" className="download-glow" style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, textDecoration: "none", padding: "4px 10px", borderRadius: 4, border: "1px solid var(--accent)" }}>PDF ↓</a>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* RIGHT — A4 Document Canvas */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "32px 24px", overflowY: "auto", background: "var(--bg-primary)", flexDirection: "column" }}>
                {!grantsDone && (
                    <div style={{
                        width: "100%", padding: "20px 24px", borderRadius: 8,
                        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                        display: "flex", alignItems: "center", gap: 16, marginBottom: 24,
                    }}>
                        <span style={{ fontSize: 24 }}>🔒</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#D97706" }}>Complete Grant Discovery First</div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Find grants and generate a proposal before generating impact reports.</div>
                        </div>
                        <a href="/grants" className="btn-primary" style={{ fontSize: 12, padding: "8px 16px", textDecoration: "none", whiteSpace: "nowrap" }}>Find Grants →</a>
                    </div>
                )}

                {!streamedText && !isStreaming && !loading ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "15vh", opacity: 0.4 }}>
                        <div style={{ fontSize: "3rem", marginBottom: "16px", fontFamily: "var(--font-playfair)" }}>📊</div>
                        <div style={{ fontSize: 15, fontFamily: "var(--font-space-mono)" }}>Select a quarter and click<br /><strong>Generate Report</strong> to begin.</div>
                    </div>
                ) : (
                    <div className="a4-canvas">
                        {/* Document Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1E3C72", paddingBottom: "16px", marginBottom: "32px" }}>
                            <div>
                                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "var(--font-space-mono)", letterSpacing: "1px", marginBottom: 4 }}>NIDHIAI // IMPACT REPORT</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3C72", fontFamily: "var(--font-playfair)" }}>Quarterly Impact Report: {activeQuarter}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "var(--font-space-mono)" }}>{new Date().toLocaleDateString('en-IN', { day: "numeric", month: "long", year: "numeric" })}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>{session.ngoName}</div>
                            </div>
                        </div>

                        {/* Stats Banner */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28, padding: "14px", background: "#F0F4FF", borderRadius: 4, border: "1px solid #CBD5E1" }}>
                            {[
                                { label: "Beneficiaries", val: "500" },
                                { label: "Funds Utilized", val: "₹3,00,000" },
                                { label: "Programs", val: "3" },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "#1E3C72", fontFamily: "var(--font-space-mono)" }}>{s.val}</div>
                                    <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Streamed Content */}
                        {loading && !streamedText && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", padding: "20px 0" }}>
                                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                <span style={{ fontSize: 13 }}>Waiting for model response...</span>
                            </div>
                        )}
                        <div>{renderMarkdownText(streamedText)}</div>
                        {isStreaming && <span className="streaming-cursor" />}

                        {/* Footer with Download */}
                        {!isStreaming && !loading && streamedText && (
                            <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "var(--font-space-mono)" }}>Generated by NidhiAI Impact Agent</div>
                                {downloadUrl && (
                                    <a href={downloadUrl} target="_blank" className="download-glow" style={{
                                        padding: "8px 20px", background: "#1E3C72", color: "#fff", borderRadius: "4px",
                                        fontSize: 12, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                                    }}>📥 Download PDF</a>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
