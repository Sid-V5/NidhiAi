"use client";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { getComplianceStatus } from "@/lib/api";

interface CertInfo {
    type: string; name: string; status: string; expiry: string;
    regNo: string; issueDate: string; confidence: number;
}

export default function CompliancePage() {
    const session = getSession();
    const [certs, setCerts] = useState<CertInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            const res = await getComplianceStatus(session.ngoId);
            if (res.ok && res.data) {
                const data = res.data as Record<string, unknown>;
                const results = (data.results as Array<Record<string, unknown>>) || [];
                const mapped: CertInfo[] = results.map((r) => {
                    const validation = (r.validationResult as Record<string, unknown>) || {};
                    const dates = (r.validityDates as Record<string, unknown>) || {};
                    return {
                        type: r.documentType as string || "unknown",
                        name: r.documentType === "12A" ? "Income Tax 12A Registration"
                            : r.documentType === "80G" ? "Section 80G Donation Exemption"
                                : "CSR-1 MCA Registration",
                        status: (validation.status as string) || (r.status as string) || "processed",
                        expiry: ((dates.expiryDate as string) || "").split("T")[0] || "—",
                        regNo: (dates.registrationNumber as string) || "—",
                        issueDate: ((dates.issueDate as string) || "").split("T")[0] || "—",
                        confidence: Math.round(((r.confidence as number) || 0.95) * 100),
                    };
                });
                setCerts(mapped);
            } else {
                setError(res.error || "Could not fetch compliance data");
            }
            setLoading(false);
        }
        load();
    }, [session.ngoId]);

    const validCount = certs.filter(c => c.status === "valid").length;
    const total = certs.length || 1;
    const score = certs.length > 0 ? Math.round((validCount / total) * 100) : 0;

    return (
        <div>
            <div className="page-header">
                <h1>Compliance Status</h1>
                <p>AI-verified compliance status for your NGO registration certificates.</p>
            </div>

            {loading && (
                <div className="corporate-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="spinner" /><span>Checking compliance status...</span>
                </div>
            )}

            {error && <div className="corporate-card" style={{ borderLeft: "3px solid var(--red)", color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}

            {!loading && certs.length === 0 && !error && (
                <div className="corporate-card" style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>📄</span>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No documents scanned yet</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Upload your 12A, 80G, and CSR-1 certificates to see compliance status.</div>
                    <a href="/upload" className="btn-primary">Upload Documents</a>
                </div>
            )}

            {certs.length > 0 && (
                <>
                    <div className="corporate-card" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 24 }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: "50%",
                            background: `conic-gradient(${score >= 80 ? "var(--green)" : "#D97706"} ${score * 3.6}deg, var(--border) 0)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span className="telemetry-text" style={{ fontSize: 18, fontWeight: 700, color: score >= 80 ? "var(--green)" : "#D97706" }}>{score}%</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>Compliance Score: {score}%</div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>{validCount} of {certs.length} certificates verified and valid</div>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                        {certs.map((cert) => (
                            <div key={cert.type} className="corporate-card" style={{ borderLeft: `4px solid ${cert.status === "valid" ? "var(--green)" : cert.status === "expired" ? "var(--red)" : "#D97706"}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontSize: 20 }}>{cert.status === "valid" ? "✅" : cert.status === "expired" ? "❌" : "⚠️"}</span>
                                            <h3 style={{ fontSize: 15, fontWeight: 600 }}>{cert.name}</h3>
                                            <span className={`badge ${cert.status === "valid" ? "badge-valid" : cert.status === "expired" ? "badge-expired" : "badge-pending"}`}>{cert.status.toUpperCase()}</span>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Registration No</div>
                                                <div className="telemetry-text" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{cert.regNo}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Issue Date</div>
                                                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{cert.issueDate}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Valid Until</div>
                                                <div style={{ fontSize: 13, color: cert.status === "valid" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{cert.expiry}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", cursor: "help" }} title="AWS Textract OCR confidence score for document parsing">Confidence ℹ️</div>
                                        <div className="telemetry-text" style={{ fontSize: 18, fontWeight: 700, color: "var(--blue)" }}>{cert.confidence}%</div>
                                    </div>
                                </div>
                                {cert.status === "expired" && (
                                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 4, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", fontSize: 13, color: "var(--red)" }}>
                                        ⚠️ This certificate expired on {cert.expiry}. Please renew it before applying for CSR grants.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
