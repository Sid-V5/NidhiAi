"use client";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { listProposals, generateProposal, searchGrants } from "@/lib/api";

interface Proposal {
    id: string; grant: string; corp: string; status: string;
    date: string; budget: string; downloadUrl?: string; grantId?: string;
}

interface GrantOption {
    grantId: string; programName: string; corporationName: string;
}

export default function ProposalsPage() {
    const session = getSession();
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [grantsDone] = useState(true); // Gate handled by Supervisor Agent orchestration

    const [activeTab, setActiveTab] = useState<"history" | "draft">("draft");
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamedText, setStreamedText] = useState("");
    const [selectedGrantId, setSelectedGrantId] = useState("");
    const [availableGrants, setAvailableGrants] = useState<GrantOption[]>([]);
    const [activeGrantLabel, setActiveGrantLabel] = useState("");
    const [downloadUrl, setDownloadUrl] = useState("");

    useEffect(() => {
        async function load() {
            const [propRes, grantRes] = await Promise.all([
                listProposals(session.ngoId),
                searchGrants({ ngoSector: session.ngoName || "NGO", ngoDescription: session.ngoName || "NGO", location: "India" }),
            ]);
            if (propRes.ok && propRes.data) {
                const raw = (propRes.data.proposals as Array<Record<string, unknown>>) || [];
                setProposals(raw.map((p, i) => ({
                    id: (p.proposalId as string) || `prop-${i}`,
                    grant: (p.grantName as string) || (p.grantId as string) || "CSR Grant",
                    grantId: (p.grantId as string) || "",
                    corp: (p.corporationName as string) || "",
                    status: (p.status as string) || "generated",
                    date: new Date((p.createdAt as string) || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
                    budget: p.budget ? `₹${(p.budget as number).toLocaleString("en-IN")}` : "—",
                    downloadUrl: (p.downloadUrl as string) || undefined,
                })));
            } else { setError(propRes.error || "Could not fetch proposals"); }

            if (grantRes.ok && grantRes.data) {
                const grants = (grantRes.data.grants as Array<Record<string, unknown>>) || [];
                setAvailableGrants(grants.map(g => ({
                    grantId: (g.grantId as string) || "",
                    programName: (g.programName as string) || "Grant",
                    corporationName: (g.corporationName as string) || "",
                })));
            }
            setLoading(false);
        }
        load();
    }, [session.ngoId, session.ngoName]);

    const handleGenerate = async () => {
        if (!selectedGrantId) { alert("Please select a grant first."); return; }
        setIsGenerating(true); setStreamedText(""); setDownloadUrl("");

        const selectedGrant = availableGrants.find(g => g.grantId === selectedGrantId);
        setActiveGrantLabel(selectedGrant ? `${selectedGrant.programName} — ${selectedGrant.corporationName}` : "");

        const res = await generateProposal({
            ngoId: session.ngoId, grantId: selectedGrantId,
            ngoName: session.ngoName, ngoDescription: `${session.ngoName} seeking CSR grants`,
            grantDetails: selectedGrant || {},
        });

        if (res.ok && res.data) {
            const data = res.data as Record<string, unknown>;
            const content = data.content as Record<string, unknown> | undefined;
            if (data.downloadUrl) setDownloadUrl(data.downloadUrl as string);

            let fullText = "";
            if (content) {
                const parts: string[] = [];
                if (content.executiveSummary) parts.push(`# Executive Summary\n${content.executiveSummary}`);
                if (content.organizationBackground) parts.push(`\n# Organization Background\n${content.organizationBackground}`);
                if (content.problemStatement) parts.push(`\n# Problem Statement\n${content.problemStatement}`);
                if (content.proposedSolution) parts.push(`\n# Proposed Solution\n${content.proposedSolution}`);
                const budget = content.budgetTable as Array<Record<string, unknown>> | undefined;
                if (budget?.length) {
                    parts.push(`\n# Budget Breakdown`);
                    budget.forEach(b => parts.push(`• ${b.category}: ₹${(Number(b.amount) || 0).toLocaleString("en-IN")} — ${b.description}`));
                    const total = budget.reduce((s, b) => s + (Number(b.amount) || 0), 0);
                    parts.push(`\nTotal: ₹${total.toLocaleString("en-IN")}`);
                }
                const metrics = content.impactMetrics as Array<Record<string, string>> | undefined;
                if (metrics?.length) {
                    parts.push(`\n# Impact Metrics`);
                    metrics.forEach(m => parts.push(`• ${m.metric}: ${m.baseline} → ${m.target}`));
                }
                const timeline = content.timeline as Array<Record<string, unknown>> | undefined;
                if (timeline?.length) {
                    parts.push(`\n# Implementation Timeline`);
                    timeline.forEach(t => {
                        parts.push(`\n## ${t.phase} (${t.duration})`);
                        const milestones = (t.milestones as string[]) || [];
                        milestones.forEach(m => parts.push(`• ${m}`));
                    });
                }
                if (content.conclusion) parts.push(`\n# Conclusion\n${content.conclusion}`);
                fullText = parts.join("\n");
            } else {
                fullText = (data.summary as string) || "Proposal generated successfully.";
            }

            let index = 0;
            const streamInterval = setInterval(() => {
                if (index < fullText.length) {
                    const chunk = fullText.slice(index, index + 3);
                    setStreamedText(prev => prev + chunk);
                    index += 3;
                } else { clearInterval(streamInterval); setIsGenerating(false); }
            }, 8);

            const refreshRes = await listProposals(session.ngoId);
            if (refreshRes.ok && refreshRes.data) {
                const raw = (refreshRes.data.proposals as Array<Record<string, unknown>>) || [];
                setProposals(raw.map((p, i) => ({
                    id: (p.proposalId as string) || `prop-${i}`,
                    grant: (p.grantName as string) || (p.grantId as string) || "CSR Grant",
                    grantId: (p.grantId as string) || "",
                    corp: (p.corporationName as string) || "",
                    status: (p.status as string) || "generated",
                    date: new Date((p.createdAt as string) || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
                    budget: p.budget ? `₹${(p.budget as number).toLocaleString("en-IN")}` : "—",
                    downloadUrl: (p.downloadUrl as string) || undefined,
                })));
            }
        } else {
            setStreamedText("⚠️ Failed to generate proposal. Please try again.");
            setIsGenerating(false);
        }
    };

    const renderMarkdownText = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h2 key={i} style={{ fontSize: '1.4rem', marginTop: i === 0 ? 0 : '28px', marginBottom: '12px', fontWeight: 700, color: '#1E3C72', fontFamily: 'var(--font-playfair)', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px' }}>{line.replace('# ', '')}</h2>;
            if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: '1.1rem', marginTop: '20px', marginBottom: '8px', fontWeight: 600, color: '#334155', fontFamily: 'var(--font-playfair)' }}>{line.replace('## ', '')}</h3>;
            if (line.startsWith('• ')) return <div key={i} style={{ marginLeft: '16px', marginBottom: '6px', color: '#374151', fontSize: '13px', lineHeight: 1.6, paddingLeft: '12px', borderLeft: '2px solid #CBD5E1' }}>{line.replace('• ', '')}</div>;
            if (line.startsWith('Total:')) return <div key={i} style={{ marginTop: '8px', padding: '8px 12px', background: '#F0F4FF', borderRadius: '4px', fontSize: '14px', fontWeight: 700, color: '#1E3C72', fontFamily: 'var(--font-space-mono)' }}>{line}</div>;
            if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
            return <p key={i} style={{ marginBottom: '10px', color: '#374151', lineHeight: 1.75, fontSize: '13.5px' }}>{line}</p>;
        });
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100vh - 80px)", gap: 0 }}>
            {/* LEFT — Sidebar Controls */}
            <div style={{ borderRight: "1px solid var(--border)", padding: "28px 20px", display: "flex", flexDirection: "column", gap: "16px", background: "var(--bg-secondary)" }}>
                <div>
                    <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 4 }}>Proposals</h1>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>AI-drafted CSR proposals.</p>
                </div>

                <div style={{ display: "flex", gap: "4px", background: "var(--bg-primary)", borderRadius: "4px", padding: "3px" }}>
                    {(["draft", "history"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                background: activeTab === tab ? "var(--bg-card)" : "transparent",
                                color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                                border: activeTab === tab ? "1px solid var(--border)" : "1px solid transparent",
                                borderRadius: "3px", cursor: "pointer", textTransform: "capitalize",
                            }}>{tab === "draft" ? "New Draft" : `History (${proposals.length})`}</button>
                    ))}
                </div>

                {activeTab === "draft" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Target Grant</label>
                            <select value={selectedGrantId} onChange={(e) => setSelectedGrantId(e.target.value)} className="input-field" style={{ fontSize: 13 }}>
                                <option value="">Choose a grant...</option>
                                {availableGrants.map(g => (
                                    <option key={g.grantId} value={g.grantId}>{g.programName} — {g.corporationName}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn-primary" style={{ width: "100%", fontSize: 13 }} onClick={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? "⚡ Generating..." : "▶ Draft Proposal"}
                        </button>
                        {isGenerating && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {["Analyzing grant requirements...", "Generating proposal content...", "Formatting document..."].map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
                                        <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />{s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1 }}>
                        {loading && <div className="spinner" style={{ margin: "20px auto" }} />}
                        {error && <div style={{ color: "var(--red)", fontSize: 12 }}>⚠️ {error}</div>}
                        {!loading && proposals.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", marginTop: 20 }}>No proposals yet.</div>}
                        {proposals.map((p) => (
                            <div key={p.id} style={{ padding: "12px", borderRadius: 4, background: "var(--bg-primary)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{p.grant}</div>
                                {p.corp && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.corp}</div>}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                    <span className="telemetry-text" style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.date}</span>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <span className="badge badge-valid" style={{ fontSize: 9 }}>{p.status}</span>
                                        {p.downloadUrl && <a href={p.downloadUrl} target="_blank" style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>PDF ↓</a>}
                                    </div>
                                </div>
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
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Search for grants and select one before drafting a proposal.</div>
                        </div>
                        <a href="/grants" className="btn-primary" style={{ fontSize: 12, padding: "8px 16px", textDecoration: "none", whiteSpace: "nowrap" }}>Find Grants →</a>
                    </div>
                )}

                {!streamedText && !isGenerating ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "15vh", opacity: 0.4 }}>
                        <div style={{ fontSize: "3rem", marginBottom: "16px", fontFamily: "var(--font-playfair)" }}>📄</div>
                        <div style={{ fontSize: 15, fontFamily: "var(--font-space-mono)" }}>Select a grant and click<br /><strong>Draft Proposal</strong> to begin.</div>
                    </div>
                ) : (
                    <div className="a4-canvas">
                        {/* Document Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1E3C72", paddingBottom: "16px", marginBottom: "32px" }}>
                            <div>
                                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "var(--font-space-mono)", letterSpacing: "1px", marginBottom: 4 }}>NIDHIAI // GRANT PROPOSAL</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3C72", fontFamily: "var(--font-playfair)" }}>{activeGrantLabel || "CSR Proposal Draft"}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "var(--font-space-mono)" }}>{new Date().toLocaleDateString('en-IN', { day: "numeric", month: "long", year: "numeric" })}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>By: {session.ngoName}</div>
                            </div>
                        </div>

                        {/* Streamed Content */}
                        <div>{renderMarkdownText(streamedText)}</div>
                        {isGenerating && <span className="streaming-cursor" />}

                        {/* Footer with Download */}
                        {!isGenerating && streamedText && (
                            <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "var(--font-space-mono)" }}>Generated by NidhiAI</div>
                                {downloadUrl && (
                                    <a href={downloadUrl} target="_blank" style={{
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
