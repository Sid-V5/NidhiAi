"use client";

interface GrantCardProps {
    grantId: string;
    corporationName: string;
    programName: string;
    focusAreas: string[];
    fundingRange: { min: number; max: number };
    relevanceScore: number;
    matchReason?: string;
    geographicScope?: string[];
    onSelect?: (grantId: string) => void;
}

export default function GrantCard({
    grantId, corporationName, programName, focusAreas,
    fundingRange, relevanceScore, matchReason, geographicScope, onSelect,
}: GrantCardProps) {
    const scorePercent = Math.round(relevanceScore * 100);

    return (
        <div className="corporate-card" style={{
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "260px"
        }}
            onClick={() => onSelect?.(grantId)}>

            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                            {corporationName}
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                            {programName}
                        </h3>
                    </div>

                    <div className="badge badge-valid" style={{ padding: "6px 12px", flexShrink: 0 }}>
                        {scorePercent}% MATCH
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Funding Range</div>
                        <div className="telemetry-text" style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
                            ₹{(fundingRange.min / 100000).toFixed(1)}L – {(fundingRange.max / 100000).toFixed(1)}L
                        </div>
                    </div>
                    {geographicScope && geographicScope.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Region</div>
                            <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
                                {geographicScope.slice(0, 2).join(", ")}
                            </div>
                        </div>
                    )}
                </div>

                {matchReason && (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, background: "var(--bg-primary)", padding: "12px", borderRadius: "4px", borderLeft: "3px solid var(--accent)" }}>
                        {matchReason}
                    </div>
                )}
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {focusAreas.slice(0, 2).map((area) => (
                        <span key={area} className="badge" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "0.7rem" }}>{area}</span>
                    ))}
                </div>
                <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(grantId); }}>
                    Generate Proposal
                </button>
            </div>
        </div>
    );
}
