'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api, type Organization } from "../../../lib/api-client";
import { getToken } from "../../../lib/auth";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Building2, Plus } from "lucide-react";

export default function OrgsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orgsQuery = useQuery<Organization[], ApiError>({
    queryKey: ["orgs"],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.listOrgs(token);
    },
  });

  const createMutation = useMutation({
    mutationFn: (orgName: string) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.createOrg(token, orgName);
    },
    onSuccess: () => {
      setName("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to create org");
    },
  });

  return (
    <div className="dashboard-page">
      <header className="page-intro">
        <div><p className="page-kicker mono">WORKSPACES / 01</p><h1>Organizations</h1><p>Choose the workspace where your agent investigations live.</p></div>
        <div className="page-intro-mark"><Building2 /></div>
      </header>

      {orgsQuery.isPending && <p className="state-panel">Loading organizations…</p>}
      {orgsQuery.isError && (
        <p className="state-panel state-error" role="alert">
          Failed to load organizations: {orgsQuery.error.message}
        </p>
      )}
      {orgsQuery.data !== undefined && orgsQuery.data.length === 0 && (
        <p className="state-panel state-empty">
          No organizations yet. Create one to get started.
        </p>
      )}
      <ul className="resource-list">
        {orgsQuery.data?.map((org) => (
          <li
            key={org.id}
            className="resource-row"
          >
            <div>
              <p className="resource-name">{org.name}</p>
              <p className="resource-meta mono">ROLE / {org.role}</p>
            </div>
            <Link
              href={`/orgs/${org.id}/projects`}
              className="resource-link"
            >
              View projects <ArrowRight />
            </Link>
          </li>
        ))}
      </ul>

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
          placeholder="New organization name"
          className="app-input"
        />
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="signal-button"
        >
          <Plus /> {createMutation.isPending ? "Creating…" : "Create organization"}
        </Button>
      </form>
      {error !== null && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
