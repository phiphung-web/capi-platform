"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";

function Shell({ children }: { children: React.ReactNode }) {
  const { token, user, projects, loading, logout } = useAuth();
  const { projectId, setProjectId } = useProject();

  if (!token || loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 p-4 flex flex-col">
        <div className="font-bold text-lg mb-6">CAPI Platform</div>
        <div className="mb-4 text-sm">
          <div className="text-slate-400 mb-1">Current Project</div>
          <select
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </select>
        </div>
        <nav className="flex-1 flex flex-col gap-2 text-sm">
          <Link href="/app/dashboard">Dashboard</Link>
          <Link href="/app/sources">Sources</Link>
          <Link href="/app/destinations">Destinations</Link>
          <Link href="/app/events">Events</Link>
          <Link href="/app/dev-console">Dev Console</Link>
        </nav>
        <div className="mt-4 text-xs">
          <div>{user.email}</div>
          <button onClick={logout} className="underline text-slate-400 mt-1">
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 space-y-4">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  return (
    <ProjectProvider>
      <Shell>{children}</Shell>
    </ProjectProvider>
  );
}
