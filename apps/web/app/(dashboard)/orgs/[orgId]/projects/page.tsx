'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { ApiError, api, type Project } from "../../../../../lib/api-client";
import { getToken } from "../../../../../lib/auth";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, ArrowRight, FolderKanban, Plus } from "lucide-react";

export default function OrgProjectsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}): React.JSX.Element {
  const { orgId } = use(params);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const projectsQuery = useQuery<Project[], ApiError>({
    queryKey: ["projects", orgId],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.listProjects(token, orgId);
    },
  });

  const createMutation = useMutation({
    mutationFn: (projectName: string) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.createProject(token, orgId, projectName);
    },
    onSuccess: (res) => {
      setName("");
      setError(null);
      setNewKey(res.apiKey.key);
      void queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to create project",
      );
    },
  });

  return (
    <div className="dashboard-page">
      <Link href="/orgs" className="back-link"><ArrowLeft /> All organizations
      </Link>
      <header className="page-intro">
        <div><p className="page-kicker mono">PROJECTS / 02</p><h1>Projects</h1><p>Each project owns its trace stream, API keys, and investigation history.</p></div>
        <div className="page-intro-mark"><FolderKanban /></div>
      </header>

      {projectsQuery.isPending && <p className="state-panel">Loading projects…</p>}
      {projectsQuery.isError && (
        <p className="state-panel state-error" role="alert">
          Failed to load projects: {projectsQuery.error.message}
        </p>
      )}
      {projectsQuery.data !== undefined && projectsQuery.data.length === 0 && (
        <p className="state-panel state-empty">
          No projects yet. Create one to get started.
        </p>
      )}
      <ul className="resource-list">
        {projectsQuery.data?.map((project) => (
          <li
            key={project.id}
            className="resource-row"
          >
            <p className="resource-name">{project.name}</p>
            <Link
              href={`/projects/${project.id}`}
              className="resource-link"
            >
              Open <ArrowRight />
            </Link>
          </li>
        ))}
      </ul>

      {newKey !== null && (
        <div className="key-notice">
          <p className="resource-name">
            New API key (shown once — copy it now):
          </p>
          <code className="key-value">{newKey}</code>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="text-link-button"
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        className="create-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length > 0) {
            createMutation.mutate(name.trim());
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="app-input"
        />
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="signal-button"
        >
          <Plus /> {createMutation.isPending ? "Creating…" : "Create project"}
        </Button>
      </form>
      {error !== null && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
