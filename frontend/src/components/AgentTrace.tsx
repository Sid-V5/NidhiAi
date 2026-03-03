"use client";
import { useState, useEffect } from "react";

interface TraceStep {
    id: string;
    agent: string;
    action: string;
    status: "pending" | "active" | "complete" | "error";
    detail?: string;
    timestamp?: string;
}

interface AgentTraceProps {
    steps?: TraceStep[];
    isRunning?: boolean;
}

const defaultSteps: TraceStep[] = [
    { id: "1", agent: "Supervisor", action: "Analyzing request...", status: "complete", detail: "Identified workflow: Compliance → Grant Scout → Proposal" },
    { id: "2", agent: "Compliance Agent", action: "Scanning 12A certificate with Textract", status: "complete", detail: "Found 12 fields, confidence: 96%" },
    { id: "3", agent: "Compliance Agent", action: "Validating 80G certificate", status: "complete", detail: "✅ Valid until Mar 2028" },
    { id: "4", agent: "Grant Scout", action: "Searching CSR Opportunities KB", status: "active", detail: "Querying 100+ corporate CSR reports..." },
    { id: "5", agent: "Proposal Agent", action: "Waiting for grant selection", status: "pending" },
];

const agentColors: Record<string, string> = {
    "Supervisor": "#8b5cf6",
    "Compliance Agent": "#3b82f6",
    "Grant Scout": "#10b981",
    "Proposal Agent": "#f59e0b",
    "Impact Agent": "#ec4899",
};

const statusIcons: Record<string, string> = {
    pending: "○",
    active: "◉",
    complete: "✓",
    error: "✕",
};

export default function AgentTrace({ steps = defaultSteps, isRunning = true }: AgentTraceProps) {
    const [visibleSteps, setVisibleSteps] = useState<TraceStep[]>([]);

    useEffect(() => {
        // Animate steps one by one
        steps.forEach((step, i) => {
            setTimeout(() => {
                setVisibleSteps(prev => [...prev.filter(s => s.id !== step.id), step]);
            }, i * 600);
        });
    }, [steps]);

    return (
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    🤖 Agent Activity
                    {isRunning && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                </h3>
                {isRunning && <span style={{ fontSize: 11, color: "#f59e0b" }}>Live</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {visibleSteps.map((step) => (
                    <div key={step.id} className={`trace-step ${step.status} animate-slide`} style={{ animationDelay: "0.1s" }}>
                        <div className="trace-icon" style={{
                            background: step.status === "complete" ? "rgba(16,185,129,0.15)" :
                                step.status === "active" ? "rgba(245,158,11,0.15)" :
                                    step.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(148,163,184,0.1)",
                            color: step.status === "complete" ? "#10b981" :
                                step.status === "active" ? "#f59e0b" :
                                    step.status === "error" ? "#ef4444" : "#64748b",
                        }}>
                            {statusIcons[step.status]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: agentColors[step.agent] || "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    {step.agent}
                                </span>
                            </div>
                            <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>{step.action}</div>
                            {step.detail && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{step.detail}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
