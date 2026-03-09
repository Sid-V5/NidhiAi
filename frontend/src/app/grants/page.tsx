"use client";
import { useState, useEffect } from "react";
import { getSession } from "@/lib/auth";
import { searchGrants, getComplianceStatus } from "@/lib/api";
import GrantCard from "@/components/GrantCard";
import { useRouter } from "next/navigation";

interface Grant {
    grantId: string; corporationName: string; programName: string;
    focusAreas: string[]; fundingRange: { min: number; max: number };
    relevanceScore: number; matchReason?: string; geographicScope?: string[];
}

export default function GrantsPage() {
    const session = getSession();
    const router = useRouter();
    const [grants, setGrants] = useState<Grant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("All");
    const [complianceDone, setComplianceDone] = useState(true);

    useEffect(() => {
        async function checkCompliance() {
            const compRes = await getComplianceStatus(session.ngoId);
            if (compRes.ok && compRes.data) {
                const d = compRes.data as Record<string, unknown>;
                const valid = (d.validDocuments as number) || 0;
                setComplianceDone(valid > 0);
            } else {
                setComplianceDone(false);
            }
        }
        checkCompliance();
        loadGrants();
    }, []);

    const loadGrants = async (query?: string) => {
        setLoading(true); setError("");
        const res = await searchGrants({
            ngoSector: session.ngoName || "NGO",
            ngoDescription: query || session.ngoName || "NGO",
            location: "India",
        });
        if (res.ok && res.data) {
            setGrants((res.data.grants as Grant[]) || []);
        }
        else setError(res.error || "Grant search failed");
        setLoading(false);
    };

    const handleSearch = () => { if (searchQuery.trim()) loadGrants(searchQuery); };

    const handleSelect = (grantId: string) => {
        // Redirect to proposals page with grantId as URL param — no localStorage
        router.push(`/proposals?grantId=${encodeURIComponent(grantId)}`);
    };

    const filtered = grants.filter(g => {
        if (activeFilter !== "All" && !g.focusAreas?.some(a => a.toLowerCase().includes(activeFilter.toLowerCase()))) return false;
        return true;
    });

    return (
        <div>
            {/* COMPLIANCE GATE BANNER */}
            {!complianceDone && (
                <div style={{
                    padding: "16px 20px", borderRadius: 8, background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.3)", marginBottom: 24,
                    display: "flex", alignItems: "center", gap: 16,
                }}>
                    <span style={{ fontSize: 24 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#D97706" }}>Compliance Required</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Verify your 12A, 80G &amp; CSR-1 documents first to unlock grant matching.</div>
                    </div>
                    <a href="/upload" className="btn-primary" style={{ fontSize: 12, padding: "8px 16px", textDecoration: "none", whiteSpace: "nowrap" }}>Verify Documents →</a>
                </div>
            )}
            <div className="page-header">
                <h1>Grant Discovery</h1>
                <p>AI-matched CSR funding opportunities from India&apos;s top corporations, tailored to your NGO&apos;s profile.</p>
            </div>

            <div className="corporate-card" style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>🔍</span>
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search grants by sector, corporation, or focus..."
                    className="input-field" style={{ flex: 1 }} />
                <button className="btn-primary" style={{ fontSize: 13 }} onClick={handleSearch}>Search</button>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                {["All", "Education", "Healthcare", "Women", "Environment"].map((f) => (
                    <button key={f} className={activeFilter === f ? "btn-primary" : "btn-secondary"} style={{ fontSize: 12, padding: "6px 16px" }}
                        onClick={() => setActiveFilter(f)}>{f}</button>
                ))}
            </div>

            {loading && (
                <div className="corporate-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="spinner" /><span>Matching grants to your profile...</span>
                </div>
            )}

            {error && <div className="corporate-card" style={{ borderLeft: "3px solid var(--red)", color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}

            {!loading && grants.length === 0 && !error && (
                <div className="corporate-card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>No grants found</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>Try searching for a different sector or adjust your query.</div>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    Showing {filtered.length} grant{filtered.length !== 1 ? "s" : ""} | Click a grant to draft a proposal
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {filtered.map((grant) => (
                    <GrantCard key={grant.grantId} {...grant} onSelect={handleSelect} />
                ))}
            </div>
        </div>
    );
}
