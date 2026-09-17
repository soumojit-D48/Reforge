'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { ApiError, api, type Project } from "../../../../../src/lib/api-client";
import { getToken } from "../../../../../src/lib/auth";

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
    <div className="flex flex-col gap-6">
      <Link href="/orgs" className="text-sm text-gray-600 hover:underline">
        ← All organizations
      </Link>
      <h1 className="text-2xl font-bold">Projects</h1>

      {projectsQuery.isPending && <p className="text-gray-600">Loading…</p>}
      {projectsQuery.isError && (
        <p className="text-sm text-red-600">
          Failed to load projects: {projectsQuery.error.message}
        </p>
      )}
      {projectsQuery.data !== undefined && projectsQuery.data.length === 0 && (
        <p className="text-gray-600">
          No projects yet. Create one to get started.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {projectsQuery.data?.map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between rounded border px-4 py-3"
          >
            <p className="font-medium">{project.name}</p>
            <Link
              href={`/projects/${project.id}`}
              className="text-sm underline"
            >
              Open
            </Link>
          </li>
        ))}
      </ul>

      {newKey !== null && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">
            New API key (shown once — copy it now):
          </p>
          <code className="mt-1 block break-all">{newKey}</code>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        className="flex gap-2"
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
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Create
        </button>
      </form>
      {error !== null && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
