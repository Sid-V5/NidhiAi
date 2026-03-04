"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";

export interface TraceEvent {
    type: "planning" | "agent_invocation" | "observation" | "model_invocation" | "completion" | "error";
    agentName: string;
    action: string;
    rationale?: string;
    observation?: string;
    timestamp: number;
    status: "pending" | "active" | "done" | "error";
    durationMs?: number;
}

interface AgentDef {
    id: string;
    name: string;
    color: string;
    gradient: string;
    icon: ReactNode;
}

const AGENTS: AgentDef[] = [
    {
        id: "supervisor", name: "Supervisor", color: "#818cf8", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.5-6.5-2.8 2.8m-5.4 5.4-2.8 2.8m0-11.2 2.8 2.8m5.4 5.4 2.8 2.8" /></svg>,
    },
    {
        id: "compliance", name: "Compliance", color: "#2dd4bf", gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M12 2l7 4v6c0 5.5-3.5 8.3-7 10-3.5-1.7-7-4.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
    },
    {
        id: "grant_scout", name: "Grant Scout", color: "#34d399", gradient: "linear-gradient(135deg, #059669 0%, #34d399 100%)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6m-3-3h6" /></svg>,
    },
    {
        id: "proposal", name: "Proposal", color: "#fbbf24", gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    },
    {
        id: "impact", name: "Impact", color: "#f472b6", gradient: "linear-gradient(135deg, #e11d48 0%, #f472b6 100%)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>,
    },
];

export function matchAgent(name: string): AgentDef {
    const lower = name.toLowerCase();
    if (lower.includes("compliance") || lower.includes("scan")) return AGENTS[1];
    if (lower.includes("grant") || lower.includes("scout") || lower.includes("search") || lower.includes("match")) return AGENTS[2];
    if (lower.includes("proposal") || lower.includes("pdf") || lower.includes("generate_pdf")) return AGENTS[3];
    if (lower.includes("impact") || lower.includes("report")) return AGENTS[4];
    return AGENTS[0];
}

interface AgentTraceProps {
    traces: TraceEvent[];
    isRunning: boolean;
    startTime: number;
    completion?: string;
}

export default function AgentTrace({ traces, isRunning, startTime, completion }: AgentTraceProps) {
    const [elapsed, setElapsed] = useState(0);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const traceEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isRunning && traces.length > 0) {
            const last = traces[traces.length - 1];
            setElapsed(Math.round((last.timestamp - startTime) / 1000));
            return;
        }
        if (!isRunning) return;
        const iv = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 1000)), 100);
        return () => clearInterval(iv);
    }, [isRunning, startTime, traces]);

    useEffect(() => {
        traceEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [traces.length]);

    const activeAgents = new Set(traces.map(t => matchAgent(t.agentName).id));
    const completedAgents = new Set(traces.filter(t => t.status === "done").map(t => matchAgent(t.agentName).id));
    const currentAgent = isRunning && traces.length > 0 ? matchAgent(traces[traces.length - 1].agentName).id : null;

    // Build ordered pipeline of agents that participated
    const pipelineOrder = AGENTS.filter(a => activeAgents.has(a.id));

    return (
        <div style={{ padding: "20px 0" }}>
            {/* ─── Agent Pipeline ─── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 0, padding: "16px 0", flexWrap: "wrap",
            }}>
                {AGENTS.map((agent, i) => {
                    const isActive = currentAgent === agent.id;
                    const isDone = completedAgents.has(agent.id);
                    const isSeen = activeAgents.has(agent.id);
                    return (
                        <div key={agent.id} style={{ display: "flex", alignItems: "center" }}>
                            {/* Agent node */}
                            <div style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                                position: "relative", transition: "all 0.3s ease",
                                opacity: isSeen ? 1 : 0.3,
                                transform: isActive ? "scale(1.1)" : "scale(1)",
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: "50%",
                                    background: isSeen ? agent.gradient : "rgba(255,255,255,0.05)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: isSeen ? "#fff" : "var(--text-muted)",
                                    boxShadow: isActive ? `0 0 20px ${agent.color}60, 0 0 40px ${agent.color}30` : isDone ? `0 0 12px ${agent.color}40` : "none",
                                    animation: isActive ? "glow-pulse 1.5s ease-in-out infinite" : "none",
                                    border: `2px solid ${isSeen ? agent.color : "rgba(255,255,255,0.1)"}`,
                                    position: "relative",
                                }}>
                                    {agent.icon}
                                    {isDone && (
                                        <div style={{
                                            position: "absolute", bottom: -2, right: -2,
                                            width: 16, height: 16, borderRadius: "50%",
                                            background: "#10b981", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            fontSize: 10, color: "#fff", fontWeight: 700,
                                            border: "2px solid var(--bg-card)",
                                        }}>✓</div>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                                    color: isSeen ? agent.color : "var(--text-muted)",
                                    textTransform: "uppercase",
                                }}>{agent.name}</span>
                            </div>
                            {/* Connecting arrow */}
                            {i < AGENTS.length - 1 && (
                                <div style={{
                                    width: 32, height: 2, margin: "0 4px", marginBottom: 20,
                                    background: (activeAgents.has(AGENTS[i].id) && activeAgents.has(AGENTS[i + 1].id))
                                        ? `linear-gradient(90deg, ${AGENTS[i].color}, ${AGENTS[i + 1].color})`
                                        : "rgba(255,255,255,0.08)",
                                    borderRadius: 1, position: "relative",
                                    transition: "background 0.5s ease",
                                }}>
                                    {(activeAgents.has(AGENTS[i].id) && activeAgents.has(AGENTS[i + 1].id)) && (
                                        <div style={{
                                            position: "absolute", right: -3, top: -3,
                                            width: 0, height: 0,
                                            borderTop: "4px solid transparent",
                                            borderBottom: "4px solid transparent",
                                            borderLeft: `6px solid ${AGENTS[i + 1].color}`,
                                        }} />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ─── Status Bar ─── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", marginBottom: 12,
                borderRadius: 8, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isRunning ? (
                        <>
                            <div style={{ display: "flex", gap: 3 }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{
                                        width: 5, height: 5, borderRadius: "50%",
                                        background: currentAgent ? matchAgent(traces[traces.length - 1]?.agentName || "").color : "#818cf8",
                                        animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                                    }} />
                                ))}
                            </div>
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                {currentAgent ? `${matchAgent(traces[traces.length - 1]?.agentName || "").name} processing` : "Orchestrating"}
                            </span>
                        </>
                    ) : traces.length > 0 ? (
                        <>
                            <span style={{ color: "#10b981", fontWeight: 700, fontSize: 14 }}>✓</span>
                            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 500 }}>Complete</span>
                        </>
                    ) : null}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{elapsed}s</span>
            </div>

            {/* ─── Trace Flow ─── */}
            {traces.length > 0 && (
                <div style={{ position: "relative", paddingLeft: 20 }}>
                    {/* Vertical flow line */}
                    <div style={{
                        position: "absolute", left: 9, top: 0, bottom: 0,
                        width: 2, background: "linear-gradient(180deg, rgba(129,140,248,0.4) 0%, rgba(16,185,129,0.4) 100%)",
                        borderRadius: 1,
                    }} />

                    {traces.map((trace, idx) => {
                        const agent = matchAgent(trace.agentName);
                        const isExpanded = expandedIdx === idx;
                        const dur = trace.durationMs ? `${(trace.durationMs / 1000).toFixed(1)}s` : null;
                        return (
                            <div key={idx} style={{
                                position: "relative", marginBottom: 8,
                                animation: `trace-slide-in 0.3s ease forwards`,
                                animationDelay: `${idx * 80}ms`,
                                opacity: 0,
                            }}>
                                {/* Flow node dot */}
                                <div style={{
                                    position: "absolute", left: -16, top: 14,
                                    width: 12, height: 12, borderRadius: "50%",
                                    background: trace.status === "active" ? agent.gradient : trace.status === "done" ? agent.color : "rgba(255,255,255,0.1)",
                                    border: `2px solid ${trace.status === "active" ? agent.color : "var(--bg-card)"}`,
                                    boxShadow: trace.status === "active" ? `0 0 8px ${agent.color}80` : "none",
                                    zIndex: 1,
                                }} />

                                {/* Trace card */}
                                <div
                                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                    style={{
                                        cursor: (trace.rationale || trace.observation) ? "pointer" : "default",
                                        background: "rgba(255,255,255,0.02)",
                                        border: `1px solid ${trace.status === "active" ? `${agent.color}40` : "rgba(255,255,255,0.06)"}`,
                                        borderLeft: `3px solid ${agent.color}`,
                                        borderRadius: "0 8px 8px 0",
                                        padding: "10px 14px",
                                        transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 700, color: agent.color,
                                            textTransform: "uppercase", letterSpacing: "0.08em",
                                            padding: "2px 8px", borderRadius: 4,
                                            background: `${agent.color}15`,
                                        }}>{agent.name}</span>
                                        <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{trace.action}</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            {trace.status === "active" && (
                                                <div style={{
                                                    width: 10, height: 10, borderRadius: "50%",
                                                    border: `2px solid ${agent.color}`,
                                                    borderTopColor: "transparent",
                                                    animation: "spin 0.8s linear infinite",
                                                }} />
                                            )}
                                            {dur && <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{dur}</span>}
                                            {trace.status === "done" && <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>}
                                            {trace.status === "error" && <span style={{ color: "#ef4444", fontWeight: 700 }}>✗</span>}
                                        </div>
                                    </div>
                                    {(isExpanded || trace.status === "error") && (trace.rationale || trace.observation) && (
                                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                            {trace.rationale && (
                                                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.5 }}>
                                                    <span style={{ color: agent.color, fontWeight: 600 }}>Reasoning: </span>{trace.rationale}
                                                </p>
                                            )}
                                            {trace.observation && (
                                                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                                    <span style={{ color: "#10b981", fontWeight: 600 }}>Result: </span>{trace.observation}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={traceEndRef} />
                </div>
            )}

            {/* ─── Supervisor Response ─── */}
            {!isRunning && completion && (
                <div style={{
                    marginTop: 16,
                    background: "linear-gradient(135deg, rgba(129,140,248,0.06) 0%, rgba(16,185,129,0.06) 100%)",
                    border: "1px solid rgba(129,140,248,0.2)",
                    borderRadius: 12, padding: 20,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: AGENTS[0].gradient,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 12,
                        }}>{AGENTS[0].icon}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: AGENTS[0].color }}>Supervisor Response</span>
                    </div>
                    <div style={{
                        fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                    }}>{completion}</div>
                </div>
            )}

            <style>{`
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 20px var(--agent-glow, rgba(129,140,248,0.3)); }
                    50% { box-shadow: 0 0 35px var(--agent-glow, rgba(129,140,248,0.5)), 0 0 60px var(--agent-glow, rgba(129,140,248,0.2)); }
                }
                @keyframes dot-bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1.2); opacity: 1; }
                }
                @keyframes trace-slide-in {
                    from { opacity: 0; transform: translateX(-8px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
