'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api, type Organization } from "../../../src/lib/api-client";
import { getToken } from "../../../src/lib/auth";

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Organizations</h1>

      {orgsQuery.isPending && <p className="text-gray-600">Loading…</p>}
      {orgsQuery.isError && (
        <p className="text-sm text-red-600">
          Failed to load organizations: {orgsQuery.error.message}
        </p>
      )}
      {orgsQuery.data !== undefined && orgsQuery.data.length === 0 && (
        <p className="text-gray-600">
          No organizations yet. Create one to get started.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {orgsQuery.data?.map((org) => (
          <li
            key={org.id}
            className="flex items-center justify-between rounded border px-4 py-3"
          >
            <div>
              <p className="font-medium">{org.name}</p>
              <p className="text-xs text-gray-500">Role: {org.role}</p>
            </div>
            <Link
              href={`/orgs/${org.id}/projects`}
              className="text-sm underline"
            >
              View projects
            </Link>
          </li>
        ))}
      </ul>

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
          placeholder="New organization name"
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
