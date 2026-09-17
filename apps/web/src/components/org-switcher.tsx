'use client';

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, type Organization } from "../lib/api-client";
import { getToken } from "../lib/auth";

export function OrgSwitcher(): React.JSX.Element | null {
  const router = useRouter();
  const params = useParams();
  const rawOrgId = params.orgId;
  const currentOrgId =
    typeof rawOrgId === "string" ? rawOrgId : "";

  const orgsQuery = useQuery<Organization[], ApiError>({
    queryKey: ["orgs"],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, "Not authenticated");
      }
      return api.listOrgs(token);
    },
    enabled:
      typeof window !== "undefined" && getToken() !== null,
  });

  if (orgsQuery.data === undefined || orgsQuery.data.length === 0) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Org
      <select
        aria-label="Switch organization"
        value={currentOrgId}
        onChange={(e) => {
          if (e.target.value !== "") {
            router.push(`/orgs/${e.target.value}/projects`);
          }
        }}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="">Select…</option>
        {orgsQuery.data.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </label>
  );
}
