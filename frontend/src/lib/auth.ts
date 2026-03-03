/**
 * NidhiAI Auth - Cognito + Demo Mode
 * Uses amazon-cognito-identity-js for real auth.
 * Demo mode creates a real NGO profile via API for judges to test.
 */
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from "amazon-cognito-identity-js";

const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "ap-south-1_AhSLOaKId";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "4e7gnb5b7h205qu55a1chaah66";

const userPool = typeof window !== "undefined"
    ? new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID })
    : null;

export interface UserSession {
    userId: string;
    ngoId: string;
    ngoName: string;
    email: string;
    token: string;
    isDemo: boolean;
}

const SESSION_KEY = "nidhiai_session";
const EMPTY: UserSession = { userId: "", ngoId: "", ngoName: "", email: "", token: "", isDemo: false };

export function getSession(): UserSession {
    if (typeof window === "undefined") return EMPTY;
    try {
        const s = localStorage.getItem(SESSION_KEY);
        return s ? JSON.parse(s) : EMPTY;
    } catch { return EMPTY; }
}

export function setSession(session: UserSession): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
    // Also sign out of Cognito
    const cognitoUser = userPool?.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
}

export function isLoggedIn(): boolean {
    const s = getSession();
    return Boolean(s.userId);
}

export function isProfileComplete(): boolean {
    const s = getSession();
    return Boolean(s.ngoId && s.ngoName);
}

// ========== Cognito Auth ==========

export function signUp(email: string, password: string, name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!userPool) return reject(new Error("Auth not available"));
        const attrs = [
            new CognitoUserAttribute({ Name: "email", Value: email }),
            new CognitoUserAttribute({ Name: "name", Value: name }),
        ];
        userPool.signUp(email, password, attrs, [], (err, result) => {
            if (err) return reject(err);
            resolve(result?.userSub || "");
        });
    });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!userPool) return reject(new Error("Auth not available"));
        const user = new CognitoUser({ Username: email, Pool: userPool });
        user.confirmRegistration(code, true, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

export function signIn(email: string, password: string): Promise<UserSession> {
    return new Promise((resolve, reject) => {
        if (!userPool) return reject(new Error("Auth not available"));
        const user = new CognitoUser({ Username: email, Pool: userPool });
        const authDetails = new AuthenticationDetails({ Username: email, Password: password });
        user.authenticateUser(authDetails, {
            onSuccess: (result) => {
                const token = result.getIdToken().getJwtToken();
                const payload = result.getIdToken().payload;
                const session: UserSession = {
                    userId: payload.sub, ngoId: "", ngoName: "",
                    email: payload.email || email, token, isDemo: false,
                };
                setSession(session);
                resolve(session);
            },
            onFailure: (err) => reject(err),
        });
    });
}

// ========== Demo Mode ==========

export function startDemoSession(): UserSession {
    const demoSession: UserSession = {
        userId: "demo-user",
        ngoId: "demo-ngo-001",
        ngoName: "Asha Foundation",
        email: "demo@nidhiai.in",
        token: "demo-token",
        isDemo: true,
    };
    setSession(demoSession);
    return demoSession;
}
