"use client";
import { useState } from "react";
import { invokeAgent } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; traces?: unknown[] }

const SUPERVISOR_AGENT_ID = process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID || "HB82HPMIA3";

const presetQuestions = [
    "What is CSR Section 135?",
    "What documents do NGOs need for CSR-1 registration?",
    "How much CSR was spent in India in FY2024?",
    "What are Schedule VII activities under Companies Act?",
];

export default function ChatbotPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! I'm the NidhiAI CSR Assistant. Ask me anything about CSR laws, compliance, or funding opportunities." },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>();

    const send = async (text: string) => {
        if (!text.trim() || loading) return;
        setMessages(prev => [...prev, { role: "user", content: text }]);
        setInput("");
        setLoading(true);

        const res = await invokeAgent(SUPERVISOR_AGENT_ID, text, sessionId);
        if (res.ok && res.data) {
            setMessages(prev => [...prev, { role: "assistant", content: res.data!.completion, traces: res.data!.traces }]);
            setSessionId(res.data.sessionId);
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${res.error || "Could not process your request. Please try again."}` }]);
        }
        setLoading(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1>CSR Assistant</h1>
                <p>Your AI-powered advisor for CSR laws, compliance requirements, and funding opportunities.</p>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {presetQuestions.map((q) => (
                    <button key={q} onClick={() => send(q)} className="btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}>{q}</button>
                ))}
            </div>

            <div className="corporate-card" style={{ height: "calc(100vh - 280px)", display: "flex", flexDirection: "column" }}>
                <div style={{ flex: 1, overflow: "auto", padding: "8px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                            <div style={{
                                maxWidth: "75%", padding: "10px 16px", borderRadius: 4,
                                background: msg.role === "user" ? "var(--accent)" : "var(--bg-primary)",
                                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                                border: msg.role === "user" ? "none" : "1px solid var(--border)",
                                fontSize: 14, lineHeight: 1.6,
                            }}>
                                {msg.role === "assistant" && <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>NidhiAI</div>}
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 16px" }}>
                            <div className="spinner" style={{ width: 16, height: 16 }} />
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Thinking...</span>
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <input value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && send(input)}
                        placeholder="Ask about CSR laws, compliance, or grants..."
                        className="input-field" style={{ flex: 1 }} />
                    <button onClick={() => send(input)} className="btn-primary" style={{ fontSize: 14 }}>Send</button>
                </div>
            </div>
        </div>
    );
}
