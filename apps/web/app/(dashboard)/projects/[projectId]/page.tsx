'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useState } from "react";
import {
  ApiError,
  api,
  type ApiKeyView,
} from "../../../../src/lib/api-client";
import { getToken } from "../../../../src/lib/auth";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.JSX.Element {
  const { projectId } = use(params);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const keysQuery = useQuery<ApiKeyView[], ApiError>({
    queryKey: ["apiKeys", projectId],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.listApiKeys(token, projectId);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.generateApiKey(token, projectId);
    },
    onSuccess: (res) => {
      setError(null);
      setFreshKey(res.key);
      void queryClient.invalidateQueries({ queryKey: ["apiKeys", projectId] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Failed to generate key",
      );
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.revokeApiKey(token, projectId, keyId);
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["apiKeys", projectId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to revoke key");
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (keyId: string) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.rotateApiKey(token, projectId, keyId);
    },
    onSuccess: (res) => {
      setError(null);
      setFreshKey(res.apiKey.key);
      void queryClient.invalidateQueries({ queryKey: ["apiKeys", projectId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Failed to rotate key");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Project API keys</h1>

      {freshKey !== null && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">
            New API key (shown once — copy it now):
          </p>
          <code className="mt-1 block break-all">{freshKey}</code>
          <button
            type="button"
            onClick={() => setFreshKey(null)}
            className="mt-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {keysQuery.isPending && <p className="text-gray-600">Loading…</p>}
      {keysQuery.isError && (
        <p className="text-sm text-red-600">
          Failed to load keys: {keysQuery.error.message}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {keysQuery.data?.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between rounded border px-4 py-3 text-sm"
          >
            <div>
              <code className="break-all">{k.publicKey}</code>
              <p className="text-xs text-gray-500">Status: {k.status}</p>
            </div>
            {k.status === "active" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={rotateMutation.isPending}
                  onClick={() => rotateMutation.mutate(k.id)}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
                >
                  Rotate
                </button>
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(k.id)}
                  className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={generateMutation.isPending}
        onClick={() => generateMutation.mutate()}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Generate new key
      </button>
      {error !== null && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
