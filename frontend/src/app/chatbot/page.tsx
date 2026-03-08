"use client";
import React, { useState, useRef, useEffect } from "react";
import { invokeAgent } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; traces?: unknown[] }

const SUPERVISOR_AGENT_ID = process.env.NEXT_PUBLIC_SUPERVISOR_AGENT_ID || "HB82HPMIA3";

const presetQuestions = [
    "What is CSR Section 135?",
    "What documents do NGOs need for CSR-1 registration?",
    "How much CSR was spent in India in FY2024?",
    "What are Schedule VII activities under Companies Act?",
];

/**
 * Parse raw Bedrock agent response — strip function call XML and extract actual content.
 * Handles patterns like: <__function=X__sendMessage> <__parameter=content>TEXT</__parameter>
 */
function parseAgentResponse(raw: string): string {
    if (!raw) return "";
    // Extract content from <__parameter=content>...</__parameter> tags
    const contentMatch = raw.match(/<__parameter=content>([\s\S]*?)(<\/__parameter>|$)/i);
    if (contentMatch) {
        let extracted = contentMatch[1].trim();
        // Remove any remaining XML-like function tags
        extracted = extracted.replace(/<\/?__[^>]*>/g, "").trim();
        return extracted;
    }
    // If the whole string looks like it starts with function XML, strip it
    if (raw.includes("<__function=")) {
        const cleaned = raw.replace(/<\/?__[^>]*>/g, "").trim();
        return cleaned || raw;
    }
    return raw;
}

/**
 * Render text with basic markdown formatting into React elements.
 */
function renderMarkdown(text: string): React.ReactNode[] {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
            elements.push(<div key={i} style={{ height: 6 }} />);
            return;
        }
        // Headings: **Bold Header** at start of line or # Heading
        if (trimmed.startsWith("# ")) {
            elements.push(
                <div key={i} style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: i > 0 ? 16 : 0, marginBottom: 6 }}>
                    {trimmed.replace(/^#+\s*/, "")}
                </div>
            );
            return;
        }
        // Numbered lists
        if (/^\d+\.\s/.test(trimmed)) {
            elements.push(
                <div key={i} style={{ paddingLeft: 16, marginBottom: 4, fontSize: 14, lineHeight: 1.6 }}>
                    {renderInlineFormatting(trimmed)}
                </div>
            );
            return;
        }
        // Bullet lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
            elements.push(
                <div key={i} style={{ paddingLeft: 16, marginBottom: 4, fontSize: 14, lineHeight: 1.6 }}>
                    • {renderInlineFormatting(trimmed.replace(/^[-•*]\s*/, ""))}
                </div>
            );
            return;
        }
        // Regular paragraph
        elements.push(
            <p key={i} style={{ marginBottom: 6, fontSize: 14, lineHeight: 1.6 }}>
                {renderInlineFormatting(trimmed)}
            </p>
        );
    });

    return elements;
}

/**
 * Handle inline formatting: **bold**, *italic*
 */
function renderInlineFormatting(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Split on **bold** patterns
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
}

export default function ChatbotPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! I'm the NidhiAI CSR Assistant. Ask me anything about CSR laws, compliance, or funding opportunities." },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const send = async (text: string) => {
        if (!text.trim() || loading) return;
        setMessages(prev => [...prev, { role: "user", content: text }]);
        setInput("");
        setLoading(true);

        const res = await invokeAgent(SUPERVISOR_AGENT_ID, text, sessionId);
        if (res.ok && res.data) {
            const parsed = parseAgentResponse(res.data.completion);
            setMessages(prev => [...prev, { role: "assistant", content: parsed, traces: res.data!.traces }]);
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
                <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "8px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                            <div style={{
                                maxWidth: "75%", padding: "12px 16px", borderRadius: 4,
                                background: msg.role === "user" ? "var(--accent)" : "var(--bg-primary)",
                                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                                border: msg.role === "user" ? "none" : "1px solid var(--border)",
                                fontSize: 14, lineHeight: 1.6,
                                wordBreak: "break-word", overflowWrap: "anywhere",
                            }}>
                                {msg.role === "assistant" && <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>NidhiAI</div>}
                                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
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
                    <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary" style={{ fontSize: 14 }}>Send</button>
                </div>
            </div>
        </div>
    );
}
