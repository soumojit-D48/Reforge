'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clearToken, getToken } from "../../lib/auth";
import { OrgSwitcher } from "../../components/org-switcher";
import { AppBrand } from "../../components/app-brand";
import { ThemeToggle } from "../../components/theme-toggle";
import { LogOut, Radar } from "lucide-react";

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
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <nav className="dashboard-nav">
          <AppBrand />
          <Link href="/orgs" className="dashboard-nav-link"><Radar /> Organizations</Link>
        </nav>
        <div className="dashboard-actions">
          <ThemeToggle />
          <button
          type="button"
          onClick={logout}
          className="logout-button"
          >
            <LogOut /> Log out
          </button>
        </div>
      </header>
      <div className="dashboard-context">
        <OrgSwitcher />
      </div>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
