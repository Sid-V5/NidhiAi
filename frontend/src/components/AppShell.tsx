"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const PUBLIC_ROUTES = ["/", "/signin"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (isPublic) {
        return <>{children}</>;
    }

    return (
        <>
            <Sidebar />
            <main className="page-container">{children}</main>
        </>
    );
}
