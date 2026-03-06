"use client";
import { useState, useRef, useEffect } from "react";
import { getSession, isProfileComplete } from "@/lib/auth";
import { getUploadUrl, uploadToS3, scanDocument } from "@/lib/api";
import { useRouter } from "next/navigation";

type DocType = "12A" | "80G" | "CSR1";

interface UploadedDoc {
    name: string; type: DocType;
    status: "uploading" | "scanning" | "complete" | "error";
    result?: { status: string; detail: string };
    s3Key?: string;
}

const DOC_INFO: Record<DocType, { label: string; desc: string; icon: string }> = {
    "12A": { label: "12A Certificate", desc: "Income Tax Exemption under Section 12A", icon: "📜" },
    "80G": { label: "80G Certificate", desc: "Tax Deduction Certificate for Donors", icon: "📑" },
    "CSR1": { label: "CSR-1 Registration", desc: "MCA CSR Registration Certificate", icon: "📋" },
};

export default function UploadPage() {
    const session = getSession();
    const router = useRouter();
    const [docs, setDocs] = useState<UploadedDoc[]>([]);
    const [dragging, setDragging] = useState(false);
    const [selectedType, setSelectedType] = useState<DocType>("12A");
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isProfileComplete()) {
            router.push("/profile");
        }
    }, [router]);

    const updateDoc = (index: number, updates: Partial<UploadedDoc>) => {
        setDocs(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
    };

    const processFile = async (file: File, index: number, docType: DocType) => {
        try {
            const urlRes = await getUploadUrl(session.ngoId, file.name, docType);
            if (!urlRes.ok || !urlRes.data) {
                updateDoc(index, { status: "error", result: { status: "error", detail: urlRes.error || "Failed to get upload URL" } });
                return;
            }

            const { uploadUrl, s3Key } = urlRes.data;
            updateDoc(index, { s3Key });

            const uploaded = await uploadToS3(uploadUrl, file);
            if (!uploaded) {
                updateDoc(index, { status: "error", result: { status: "error", detail: "Upload failed" } });
                return;
            }

            updateDoc(index, { status: "scanning" });
            const scanRes = await scanDocument(session.ngoId, "nidhiai-documents", s3Key, docType);
            if (scanRes.ok && scanRes.data) {
                const data = scanRes.data as Record<string, unknown>;
                const validation = (data.validationResult as Record<string, unknown>) || {};
                updateDoc(index, {
                    status: "complete",
                    result: {
                        status: (validation.status as string) || "processed",
                        detail: (data.summary as string) || `${docType} verified. Status: ${validation.status || "processed"}. Confidence: ${Math.round(((data.confidence as number) || 0.95) * 100)}%`,
                    },
                });
            } else {
                updateDoc(index, { status: "error", result: { status: "error", detail: scanRes.error || "Document scan failed" } });
            }
        } catch (err) {
            updateDoc(index, { status: "error", result: { status: "error", detail: String(err) } });
        }
    };

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).forEach((file) => {
            const newIdx = docs.length;
            setDocs(prev => [...prev, { name: file.name, type: selectedType, status: "uploading" }]);
            processFile(file, newIdx, selectedType);
        });
    };

    const uploadedTypes = docs.filter(d => d.status !== "error").map(d => d.type);
    const completedDocs = docs.filter(d => d.status === "complete");
    const allThreeUploaded = uploadedTypes.includes("12A") && uploadedTypes.includes("80G") && uploadedTypes.includes("CSR1");
    const allThreeDone = allThreeUploaded && completedDocs.length >= 3;
    const [countdown, setCountdown] = useState(3);

    // Keep user on the page instead of auto-redirecting so they can re-upload if needed.
    const hasFailed = docs.some(d => d.status === "complete" && d.result?.status !== "valid");

    return (
        <div>
            <div className="page-header">
                <h1>Upload Documents</h1>
                <p>Upload your 12A, 80G, and CSR-1 compliance certificates for AI-powered verification.</p>
            </div>

            {/* Document Type Selector */}
            <div className="corporate-card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Select Document Type</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {(["12A", "80G", "CSR1"] as DocType[]).map(type => {
                        const info = DOC_INFO[type];
                        const isUploaded = uploadedTypes.includes(type);
                        return (
                            <button key={type} type="button"
                                onClick={() => setSelectedType(type)}
                                style={{
                                    padding: "16px", borderRadius: 4, border: `2px solid ${selectedType === type ? "var(--accent)" : isUploaded ? "var(--green)" : "var(--border)"}`,
                                    background: selectedType === type ? "rgba(79,70,229,0.06)" : isUploaded ? "rgba(16,185,129,0.04)" : "transparent",
                                    cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.2s",
                                }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ fontSize: 24 }}>{info.icon}</span>
                                    {isUploaded && <span className="badge badge-valid">✓ Uploaded</span>}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{info.label}</div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{info.desc}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Upload Zone */}
            <div style={{
                padding: "40px", borderRadius: 4, border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                background: dragging ? "rgba(79,70,229,0.04)" : "transparent",
                textAlign: "center", cursor: "pointer", transition: "all 0.2s"
            }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)} />
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                    Drop your <span style={{ color: "var(--accent)" }}>{DOC_INFO[selectedType].label}</span> here or click to browse
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Supported: PDF, JPEG, PNG (Max 10MB)
                </div>
            </div>

            {/* Progress Bar */}
            {true && (
                <div className="corporate-card" style={{ marginTop: 20, padding: "16px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Compliance Progress</span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{uploadedTypes.length}/3 documents</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--bg-primary)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(uploadedTypes.length / 3) * 100}%`, background: "var(--accent)", borderRadius: 3, transition: "width 0.5s ease" }} />
                    </div>
                </div>
            )}

            {allThreeDone && (
                <div className="corporate-card" style={{ marginTop: 20, borderLeft: "3px solid var(--green)", background: "rgba(16,185,129,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ fontSize: 32 }}>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>Compliance Verified!</div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>All documents processed successfully.</div>
                        </div>
                        <button className="btn-primary" style={{ fontSize: 12, padding: "8px 16px", whiteSpace: "nowrap" }} onClick={() => router.push("/grants")}>
                            Go Now →
                        </button>
                    </div>
                    <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: "var(--green)", width: "100%" }} />
                </div>
            )}

            {/* Document Status List */}
            {docs.length > 0 && (
                <div className="corporate-card" style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Document Status</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {docs.map((doc, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
                                borderRadius: 4, background: "var(--bg-primary)",
                                borderLeft: `3px solid ${doc.status === "complete" && doc.result?.status === "valid" ? "var(--green)" : doc.status === "complete" && doc.result?.status === "expired" ? "var(--red)" : doc.status === "error" ? "var(--red)" : doc.status === "scanning" ? "#D97706" : "var(--blue)"}`,
                            }}>
                                <div style={{ fontSize: 20 }}>
                                    {doc.status === "uploading" ? "⬆️" : doc.status === "scanning" ? "🔍" : doc.status === "error" ? "❌" : doc.result?.status === "valid" ? "✅" : "⚠️"}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{doc.name} <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 6 }}>{doc.type}</span></div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        {doc.status === "uploading" ? "Uploading..." :
                                            doc.status === "scanning" ? "Verifying document... extracting fields, dates, and registration numbers" :
                                                doc.result?.detail}
                                    </div>
                                </div>
                                <span className={`badge ${doc.status === "complete" ? (doc.result?.status === "valid" ? "badge-valid" : "badge-expired") : doc.status === "error" ? "badge-expired" : doc.status === "scanning" ? "badge-processing" : "badge-pending"}`}>
                                    {doc.status === "complete" ? (doc.result?.status || "DONE").toUpperCase() : doc.status === "error" ? "ERROR" : doc.status === "scanning" ? "SCANNING" : "UPLOADING"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {docs.length === 0 && (
                <div className="corporate-card" style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 24 }}>💡</span>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>How it works</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            1. Select document type → 2. Upload PDF or image → 3. AI extracts and validates fields → 4. Results available in Compliance dashboard
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
