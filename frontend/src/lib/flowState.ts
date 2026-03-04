/**
 * NidhiAI Flow State — tracks user progress through the compliance → grants → proposals chain.
 * Stored in localStorage so it persists across page navigations.
 *
 * Flow gates:
 *   /upload  → always accessible
 *   /grants  → requires complianceStatus === "passed"
 *   /proposals, /reports → requires at least one grant searched (grantsSearched === true)
 */

export interface FlowState {
    /** "passed" = all 3 docs verified, "failed" = at least one failed, null = not done */
    complianceStatus: "passed" | "failed" | null;
    /** ISO timestamp of when compliance was completed */
    complianceCompletedAt?: string;
    /** Number of documents that passed */
    docsVerified: number;
    /** Whether the user has searched for grants at least once */
    grantsSearched: boolean;
    /** Last grant the user selected for proposal generation */
    lastSelectedGrantId?: string;
    lastSelectedGrantName?: string;
    /** Number of proposals generated this session */
    proposalsGenerated: number;
}

const FLOW_KEY = "nidhiai_flow";

const DEFAULT: FlowState = {
    complianceStatus: null,
    docsVerified: 0,
    grantsSearched: false,
    proposalsGenerated: 0,
};

export function getFlowState(): FlowState {
    if (typeof window === "undefined") return DEFAULT;
    try {
        const raw = localStorage.getItem(FLOW_KEY);
        return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
    } catch {
        return { ...DEFAULT };
    }
}

export function setFlowState(updates: Partial<FlowState>): FlowState {
    const current = getFlowState();
    const next = { ...current, ...updates };
    if (typeof window !== "undefined") {
        localStorage.setItem(FLOW_KEY, JSON.stringify(next));
    }
    return next;
}

export function clearFlowState(): void {
    if (typeof window !== "undefined") {
        localStorage.removeItem(FLOW_KEY);
    }
}

/** Returns the next page the user should go to after completing compliance */
export function nextStepAfterCompliance(): string {
    return "/grants";
}

/** Returns true if the user is allowed to access the grants page */
export function canAccessGrants(): boolean {
    return getFlowState().complianceStatus === "passed";
}

/** Returns true if the user is allowed to access proposals/reports */
export function canAccessProposals(): boolean {
    return getFlowState().grantsSearched;
}
