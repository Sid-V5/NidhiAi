/**
 * NidhiAI API Client - ALL calls hit real API Gateway.
 * No fallback data. If API fails, UI shows error state.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://flhwtp0q9e.execute-api.ap-south-1.amazonaws.com/prod";

async function request<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("nidhiai_token") : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Profile
export async function createProfile(profile: {
  ngoName: string; panCard: string; sector: string; description?: string;
  contactEmail?: string; contactPhone?: string;
  city?: string; state?: string; pincode?: string; registrationDate?: string;
}) {
  return request("/profile", { method: "POST", body: JSON.stringify(profile) });
}

export async function getProfile(ngoId?: string, userId?: string) {
  if (ngoId) return request(`/profile?ngoId=${ngoId}`);
  if (userId) return request(`/profile?userId=${userId}`);
  return request(`/profile`);
}

// Upload
export async function getUploadUrl(ngoId: string, fileName: string, docType: string) {
  return request<{ uploadUrl: string; s3Key: string; s3Bucket: string; documentId: string }>("/upload-url", {
    method: "POST", body: JSON.stringify({ ngoId, fileName, documentType: docType }),
  });
}

export async function uploadToS3(url: string, file: File) {
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
  return res.ok;
}

// Compliance
export async function scanDocument(ngoId: string, s3Bucket: string, s3Key: string, docType: string) {
  return request("/compliance/scan", {
    method: "POST", body: JSON.stringify({ ngoId, s3Bucket, s3Key, documentType: docType }),
  });
}

export async function scanDocumentsBatch(ngoId: string, documents: Array<{ s3Bucket: string; s3Key: string; documentType: string }>) {
  return request("/compliance/scan-batch", { method: "POST", body: JSON.stringify({ ngoId, documents }) });
}

export async function getComplianceStatus(ngoId: string) {
  return request(`/compliance?ngoId=${ngoId}`);
}

// Grants
export async function searchGrants(params: {
  ngoSector: string; ngoDescription: string; location: string;
  fundingMin?: number; fundingMax?: number;
}) {
  return request<{ grants: unknown[]; totalResults: number; summary: string }>("/grants/search", {
    method: "POST", body: JSON.stringify(params),
  });
}

// Proposals
export async function generateProposal(params: {
  ngoId: string; grantId: string; ngoName: string;
  ngoDescription: string; grantDetails: unknown;
}) {
  return request<{ proposalId: string; downloadUrl: string }>("/proposals/generate", {
    method: "POST", body: JSON.stringify(params),
  });
}

export async function listProposals(ngoId: string) {
  return request<{ proposals: unknown[] }>(`/proposals?ngoId=${ngoId}`);
}

// Reports
export async function generateReport(ngoId: string, quarter: string, activityData: unknown) {
  return request("/reports/generate", {
    method: "POST", body: JSON.stringify({ ngoId, quarter, activityData }),
  });
}

// Agent invocation
export async function invokeAgent(agentId: string, prompt: string, sessionId?: string) {
  return request<{ completion: string; sessionId: string; traces: unknown[] }>("/invoke-agent", {
    method: "POST", body: JSON.stringify({ agentId, inputText: prompt, sessionId }),
  });
}
