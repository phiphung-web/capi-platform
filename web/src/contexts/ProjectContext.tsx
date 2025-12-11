"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

interface ProjectContextValue {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { projects } = useAuth();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setCurrentProjectId(null);
      return;
    }
    const exists = projects.some((p) => p.projectId === currentProjectId);
    if (!currentProjectId || !exists) {
      setCurrentProjectId(projects[0].projectId);
    }
  }, [projects, currentProjectId]);

  return (
    <ProjectContext.Provider value={{ currentProjectId, setCurrentProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useCurrentProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useCurrentProject must be used within ProjectProvider");
  }
  return ctx;
}
