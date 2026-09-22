'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  api,
  type ApiKeyView,
} from "../../../../lib/api-client";
import { getToken } from "../../../../lib/auth";
import { Button } from "../../../../components/ui/button";
import { KeyRound, RotateCcw, ShieldX, Terminal } from "lucide-react";

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
    <div className="dashboard-page">
      <header className="page-intro">
        <div><p className="page-kicker mono">PROJECT SETTINGS / API ACCESS</p><h1>Project API keys</h1><p>Use a project-scoped key to send structured traces into this workspace.</p></div>
        <div className="page-intro-mark"><KeyRound /></div>
      </header>
      <div className="page-toolbar">
        <Link
          href={`/projects/${projectId}/runs`}
          className="signal-button"
        >
          <Terminal /> Open runs
        </Link>
      </div>

      {freshKey !== null && (
        <div className="key-notice">
          <p className="resource-name">
            New API key (shown once — copy it now):
          </p>
          <code className="key-value">{freshKey}</code>
          <button
            type="button"
            onClick={() => setFreshKey(null)}
            className="text-link-button"
          >
            Dismiss
          </button>
        </div>
      )}

      {keysQuery.isPending && <p className="state-panel">Loading API keys…</p>}
      {keysQuery.isError && (
        <p className="state-panel state-error" role="alert">
          Failed to load keys: {keysQuery.error.message}
        </p>
      )}
      <ul className="resource-list">
        {keysQuery.data?.map((k) => (
          <li
            key={k.id}
            className="resource-row resource-row-key"
          >
            <div>
              <code className="break-all">{k.publicKey}</code>
              <p className="resource-meta mono">STATUS / {k.status}</p>
            </div>
            {k.status === "active" && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={rotateMutation.isPending}
                  onClick={() => rotateMutation.mutate(k.id)}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw /> Rotate
                </Button>
                <Button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(k.id)}
                  variant="outline"
                  size="sm"
                  className="danger-button"
                >
                  <ShieldX /> Revoke
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        disabled={generateMutation.isPending}
        onClick={() => generateMutation.mutate()}
        className="signal-button"
      >
        <KeyRound /> {generateMutation.isPending ? "Generating…" : "Generate new key"}
      </Button>
      {error !== null && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
