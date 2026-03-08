"use client";
import React, { useState, useEffect, useRef, type ReactNode } from "react";
import ReactMarkdown from 'react-markdown';

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
    const [isExpanded, setIsExpanded] = useState(isRunning);
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
        if (isExpanded) {
            traceEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [traces.length, isExpanded]);

    // Automatically collapse when finished, expand when running
    useEffect(() => {
        setIsExpanded(isRunning);
    }, [isRunning]);

    // Find all unique agents that have participated so far
    const activeAgents = Array.from(new Set(traces.map(t => matchAgent(t.agentName).id)));

    // If there are no traces yet, show a default orchestrator avatar
    const displayAgents = activeAgents.length > 0 ? activeAgents : ["supervisor"];

    return (
        <div style={{ padding: "16px 0", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>

            {/* ─── Grok 4.20 Style Header ─── */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: "flex", alignItems: "center", gap: 12,
                    cursor: "pointer", padding: "8px 0",
                    userSelect: "none"
                }}
            >
                {/* Overlapping Avatars */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    {displayAgents.map((agentId, i) => {
                        const agent = AGENTS.find(a => a.id === agentId)!;
                        return (
                            <div key={agent.id + i} style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: agent.gradient,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff",
                                border: "2px solid var(--bg-card, #1a1a1a)",
                                marginLeft: i > 0 ? -10 : 0,
                                zIndex: 10 - i, // Leftmost is on top
                                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                                transition: "transform 0.2s ease",
                            }}>
                                <div style={{ transform: "scale(0.55)" }}>{agent.icon}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Status Text */}
                <div style={{
                    fontSize: 15, fontWeight: 500,
                    color: "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: 6
                }}>
                    <span>{isRunning ? "Agents thinking" : "Agents finished"}</span>
                    <span style={{ fontSize: 12, opacity: 0.5 }}>•</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed}s</span>

                    {!isRunning && (
                        <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{
                                marginLeft: 4, opacity: 0.5,
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s ease"
                            }}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    )}
                </div>
            </div>

            {/* ─── Grok Style Trace Bubbles (Collapsible) ─── */}
            {isExpanded && traces.length > 0 && (
                <div style={{
                    marginTop: 16,
                    display: "flex", flexDirection: "column", gap: 20,
                    animation: "fade-in 0.3s ease-out forwards"
                }}>
                    {traces.map((trace, idx) => {
                        const agent = matchAgent(trace.agentName);
                        // Group identical consecutive agent traces visually if desired, but individual bubbles is fine.
                        return (
                            <div key={idx} style={{
                                animation: `slide-up 0.3s ease forwards`,
                                opacity: 0,
                                animationDelay: `${Math.min(idx * 50, 500)}ms`
                            }}>
                                {/* Agent Name Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: "50%",
                                        background: agent.gradient,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "#fff",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                                    }}>
                                        <div style={{ transform: "scale(0.45)" }}>{agent.icon}</div>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                                        {agent.name}
                                    </span>
                                    {trace.status === "active" && (
                                        <span style={{
                                            fontSize: 12, color: "var(--text-muted)",
                                            display: "flex", alignItems: "center", gap: 4
                                        }}>
                                            <div style={{
                                                width: 8, height: 8, borderRadius: "50%",
                                                border: `2px solid ${agent.color}`,
                                                borderTopColor: "transparent",
                                                animation: "spin 0.8s linear infinite",
                                            }} />
                                        </span>
                                    )}
                                </div>

                                {/* Trace Bubble */}
                                <div style={{
                                    marginLeft: 30, // Aligned with the name
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: "4px 14px 14px 14px",
                                    padding: "12px 16px",
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    color: "var(--text-secondary)",
                                }}>
                                    <div style={{ color: "var(--text-primary)", marginBottom: (trace.rationale || trace.observation) ? 8 : 0 }}>
                                        {trace.action}
                                    </div>

                                    {trace.rationale && (
                                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${agent.color}50` }}>
                                            {trace.rationale}
                                        </div>
                                    )}

                                    {trace.observation && (
                                        <div style={{ fontSize: 13, color: "rgba(16,185,129,0.7)", marginTop: 6, paddingLeft: 10, borderLeft: `2px solid rgba(16,185,129,0.5)` }}>
                                            {trace.observation}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={traceEndRef} />
                </div>
            )}

            {/* ─── Supervisor Final Response ─── */}
            {!isRunning && completion && (
                <div style={{
                    marginTop: 24, padding: "16px 20px",
                    background: "rgba(129,140,248,0.05)",
                    border: "1px solid rgba(129,140,248,0.2)",
                    borderRadius: 12,
                    animation: "fade-in 0.5s ease-out"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: AGENTS[0].gradient,
                            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff"
                        }}>
                            <div style={{ transform: "scale(0.55)" }}>{AGENTS[0].icon}</div>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: AGENTS[0].color }}>Final Response</span>
                    </div>
                    <div style={{
                        fontSize: 15, lineHeight: 1.7, color: "var(--text-primary)",
                        whiteSpace: "pre-wrap"
                    }}>
                        <ReactMarkdown
                            components={{
                                h2({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) {
                                    return <h2 style={{ fontSize: 18, marginTop: 16, marginBottom: 12, color: "var(--text-primary)", borderBottom: "1px solid var(--border)", paddingBottom: 8 }} {...props}>{children}</h2>;
                                },
                                h3({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) {
                                    return <h3 style={{ fontSize: 16, marginTop: 14, marginBottom: 8, color: "var(--text-primary)" }} {...props}>{children}</h3>;
                                },
                                h4({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) {
                                    return <h4 style={{ fontSize: 14, marginTop: 12, marginBottom: 8, color: "var(--text-primary)" }} {...props}>{children}</h4>;
                                },
                                p({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLParagraphElement>) {
                                    return <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10, color: "var(--text-secondary)" }} {...props}>{children}</p>;
                                },
                                a({ href, children, ...props }: { href?: string, children?: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
                                    const isPdf = href?.includes('.pdf') || (typeof children === 'string' && children.toLowerCase().includes('download'));
                                    if (isPdf) {
                                        return (
                                            <a href={href} target="_blank" rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                    background: 'var(--primary)', color: 'white',
                                                    padding: '8px 16px', borderRadius: '6px',
                                                    textDecoration: 'none', fontWeight: 500,
                                                    fontSize: '13px', marginTop: '12px', marginBottom: '12px',
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
                                    return <ul style={{ listStyleType: "disc", paddingLeft: 20, marginBottom: 10 }} {...props} />;
                                },
                                li({ children, ...props }: { children?: React.ReactNode } & React.LiHTMLAttributes<HTMLLIElement>) {
                                    return <li style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 4 }} {...props}>{children}</li>;
                                },
                                strong({ children, ...props }: { children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
                                    return <strong style={{ fontWeight: 600, color: "var(--text-primary)" }} {...props}>{children}</strong>;
                                }
                            }}
                        >
                            {completion}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
