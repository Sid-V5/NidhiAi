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
    bgColor: string;
    icon: ReactNode;
}

const AGENTS: AgentDef[] = [
    {
        id: "supervisor", name: "Supervisor", color: "#1E3A5F", bgColor: "rgba(30,58,95,0.12)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.5-6.5-2.8 2.8m-5.4 5.4-2.8 2.8m0-11.2 2.8 2.8m5.4 5.4 2.8 2.8" /></svg>,
    },
    {
        id: "compliance", name: "Compliance", color: "#0D9488", bgColor: "rgba(13,148,136,0.12)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M12 2l7 4v6c0 5.5-3.5 8.3-7 10-3.5-1.7-7-4.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
    },
    {
        id: "grant_scout", name: "Grant Scout", color: "#059669", bgColor: "rgba(5,150,105,0.12)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /><path d="M11 8v6m-3-3h6" /></svg>,
    },
    {
        id: "proposal", name: "Proposal", color: "#D97706", bgColor: "rgba(217,119,6,0.12)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    },
    {
        id: "impact", name: "Impact", color: "#E11D48", bgColor: "rgba(225,29,72,0.12)",
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>,
    },
];

export function matchAgent(name: string): AgentDef {
    const lower = name.toLowerCase();
    if (lower.includes("compliance") || lower.includes("scan")) return AGENTS[1];
    if (lower.includes("grant") || lower.includes("scout") || lower.includes("search")) return AGENTS[2];
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

    return (
        <div className="agent-trace-container">
            {/* Avatar Row */}
            <div className="agent-trace-avatars">
                {AGENTS.map((agent) => {
                    const isActive = currentAgent === agent.id;
                    const isDone = completedAgents.has(agent.id);
                    const isSeen = activeAgents.has(agent.id);
                    return (
                        <div key={agent.id}
                            className={`agent-avatar ${isActive ? "agent-avatar--active" : ""} ${isDone ? "agent-avatar--done" : ""} ${!isSeen ? "agent-avatar--idle" : ""}`}
                            style={{ "--agent-color": agent.color, "--agent-bg": agent.bgColor } as React.CSSProperties}>
                            <div className="agent-avatar__ring">
                                <div className="agent-avatar__icon" style={{ color: isSeen ? agent.color : "var(--text-muted)" }}>{agent.icon}</div>
                            </div>
                            {isDone && <div className="agent-avatar__check">✓</div>}
                            <span className="agent-avatar__label" style={{ color: isSeen ? agent.color : "var(--text-muted)" }}>{agent.name}</span>
                        </div>
                    );
                })}
            </div>

            {/* Status */}
            <div className="agent-trace-status">
                {isRunning ? (
                    <>
                        <span className="thinking-dots"><span></span><span></span><span></span></span>
                        <span className="agent-trace-status__text">Agents orchestrating</span>
                        <span className="agent-trace-status__timer">{elapsed}s</span>
                    </>
                ) : traces.length > 0 ? (
                    <>
                        <span style={{ color: "var(--green)", fontWeight: 600 }}>✓</span>
                        <span className="agent-trace-status__text">Complete</span>
                        <span className="agent-trace-status__timer">{elapsed}s</span>
                    </>
                ) : null}
            </div>

            {/* Trace Cards */}
            {traces.length > 0 && (
                <div className="agent-trace-log">
                    {traces.map((trace, idx) => {
                        const agent = matchAgent(trace.agentName);
                        const isExpanded = expandedIdx === idx;
                        const dur = trace.durationMs ? `${(trace.durationMs / 1000).toFixed(1)}s` : null;
                        return (
                            <div key={idx} className="trace-card"
                                style={{ "--card-color": agent.color, animationDelay: `${idx * 60}ms` } as React.CSSProperties}
                                onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                                <div className="trace-card__header">
                                    <div className="trace-card__agent-dot" style={{ background: agent.color }} />
                                    <span className="trace-card__agent-name" style={{ color: agent.color }}>{agent.name}</span>
                                    <span className="trace-card__action">{trace.action}</span>
                                    <div className="trace-card__meta">
                                        {trace.status === "active" && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                                        {dur && <span className="trace-card__duration">{dur}</span>}
                                        {trace.status === "done" && <span className="trace-card__check">✓</span>}
                                        {trace.status === "error" && <span className="trace-card__error">✗</span>}
                                    </div>
                                </div>
                                {(isExpanded || trace.status === "error") && (trace.rationale || trace.observation) && (
                                    <div className="trace-card__body">
                                        {trace.rationale && <div className="trace-card__rationale">{trace.rationale}</div>}
                                        {trace.observation && <div className="trace-card__observation">{trace.observation}</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={traceEndRef} />
                </div>
            )}

            {/* Completion */}
            {!isRunning && completion && (
                <div className="agent-trace-completion">
                    <div className="agent-trace-completion__header">
                        <span style={{ fontSize: 14 }}>💬</span>
                        <span>Supervisor Response</span>
                    </div>
                    <div className="agent-trace-completion__text">{completion}</div>
                </div>
            )}
        </div>
    );
}
