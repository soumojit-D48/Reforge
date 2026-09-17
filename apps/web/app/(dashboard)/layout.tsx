'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clearToken, getToken } from "../../src/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    if (getToken() === null) {
      router.replace("/login");
    }
  }, [router]);

  const logout = (): void => {
    clearToken();
    router.push("/login");
  };

  return (
    <div className="min-h-screen font-sans">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/orgs" className="text-lg font-bold">
            Reforge
          </Link>
          <Link href="/orgs" className="text-sm text-gray-600 hover:underline">
            Organizations
          </Link>
        </nav>
        <button
          type="button"
          onClick={logout}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
