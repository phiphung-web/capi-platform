"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

type ProjectCtx = {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
};

const ProjectContext = createContext<ProjectCtx | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { projects } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].projectId);
    }
  }, [projects, projectId]);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
}
