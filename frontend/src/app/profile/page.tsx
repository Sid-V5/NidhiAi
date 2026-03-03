"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, setSession, UserSession } from "@/lib/auth";
import { createProfile, getProfile } from "@/lib/api";

export default function ProfilePage() {
    const router = useRouter();
    const session = getSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [hasProfile, setHasProfile] = useState(false);

    const [form, setForm] = useState({
        ngoName: "", panCard: "", sector: "", description: "",
        contactEmail: "", contactPhone: "",
        city: "", state: "", pincode: "",
        registrationDate: "",
    });

    useEffect(() => {
        async function load() {
            if (session.ngoId) {
                const res = await getProfile(session.ngoId);
                if (res.ok && res.data) {
                    const p = (res.data as Record<string, unknown>).profile as Record<string, string>;
                    if (p) {
                        setForm({
                            ngoName: p.ngoName || "", panCard: p.panCard || "", sector: p.sector || "",
                            description: p.description || "", contactEmail: p.contactEmail || "",
                            contactPhone: p.contactPhone || "",
                            city: p.city || "", state: p.state || "", pincode: p.pincode || "",
                            registrationDate: p.registrationDate || "",
                        });
                        setHasProfile(true);
                    }
                }
            }
            setLoading(false);
        }
        load();
    }, [session.ngoId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSuccess(""); setSaving(true);

        const res = await createProfile(form);
        if (res.ok && res.data) {
            const data = res.data as Record<string, unknown>;
            const ngoId = data.ngoId as string;
            const updated: UserSession = { ...session, ngoId, ngoName: form.ngoName };
            setSession(updated);
            setSuccess("Profile saved! Redirecting to dashboard...");
            setHasProfile(true);
            setTimeout(() => router.push("/dashboard"), 1500);
        } else {
            setError(res.error || "Failed to save profile.");
        }
        setSaving(false);
    };

    const sectors = ["Education", "Healthcare", "Women Empowerment", "Rural Development",
        "Environment", "Skill Development", "Child Welfare", "Elderly Care", "Disability"];

    const states = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
        "Gujarat", "Haryana", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
        "Uttar Pradesh", "West Bengal"];

    if (loading) return <div className="corporate-card" style={{ display: "flex", alignItems: "center", gap: 12 }}><div className="spinner" /><span>Loading profile...</span></div>;

    return (
        <div>
            <div className="page-header">
                <h1>NGO Profile</h1>
                <p>{hasProfile ? "Your organization profile details." : "Set up your organization to get started with NidhiAI."}</p>
            </div>

            {error && <div className="corporate-card" style={{ borderLeft: "3px solid var(--red)", marginBottom: 16, color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}
            {success && <div className="corporate-card" style={{ borderLeft: "3px solid var(--green)", marginBottom: 16, color: "var(--green)", fontSize: 14 }}>✅ {success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="corporate-card">
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Organization Details</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>NGO Name *</label>
                            <input required value={form.ngoName} onChange={e => setForm({ ...form, ngoName: e.target.value })}
                                placeholder="e.g., Asha Foundation" className="input-field" />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>PAN Card *</label>
                            <input required value={form.panCard} onChange={e => setForm({ ...form, panCard: e.target.value.toUpperCase() })}
                                placeholder="ABCDE1234F" maxLength={10} pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}" className="input-field" />
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Format: 5 letters + 4 digits + 1 letter</div>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Sector *</label>
                            <select required value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })} className="input-field">
                                <option value="">Select sector</option>
                                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Registration Date</label>
                            <input type="date" value={form.registrationDate} onChange={e => setForm({ ...form, registrationDate: e.target.value })}
                                className="input-field" />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder="Describe your NGO's mission and work..." rows={3} className="input-field" style={{ resize: "vertical" }} />
                        </div>
                    </div>
                </div>

                <div className="corporate-card" style={{ marginTop: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Address</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>City *</label>
                            <input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                                placeholder="e.g., Ranchi" className="input-field" />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>State *</label>
                            <select required value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="input-field">
                                <option value="">Select state</option>
                                {states.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Pincode</label>
                            <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })}
                                placeholder="834001" maxLength={6} pattern="[0-9]{6}" className="input-field" />
                        </div>
                    </div>
                </div>

                <div className="corporate-card" style={{ marginTop: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Contact Information</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Email</label>
                            <input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                                placeholder="contact@ngo.org" className="input-field" />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Phone</label>
                            <input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                                placeholder="+91 98765 43210" className="input-field" />
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: 14, padding: "12px 32px" }}>
                        {saving ? "Saving..." : hasProfile ? "Update Profile" : "Create Profile & Continue"}
                    </button>
                    {hasProfile && <a href="/dashboard" className="btn-secondary" style={{ fontSize: 14, padding: "12px 24px" }}>Go to Dashboard</a>}
                </div>
            </form>
        </div>
    );
}
