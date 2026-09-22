"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "../ui/button";
import { Reveal, StatusDot, TraceMark } from "./shared";

const navItems = [
  ["Product", "#product"], ["Workflow", "#workflow"], ["For teams", "#teams"], ["Docs", "#docs"],
] as const;

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("reforge-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";

    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("reforge-theme", next);
  };

  return { theme, toggle };
}
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "site-header-scrolled" : ""}`}>
      <nav className="page-shell nav-inner" aria-label="Main navigation">
          <Link className="wordmark" href="#top" aria-label="Reforge home">
            <TraceMark />
            <span>REFORGE</span>
          </Link>
        <div className="nav-links">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <Button
            className="icon-control"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Link className="login-link" href="/login">
            Log in
          </Link>
          <Button asChild className="primary-action nav-primary">
            <Link href="/register">
              Start investigating <ArrowRight />
            </Link>
          </Button>
          <Button
            className="icon-control mobile-menu-trigger"
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>
      {menuOpen && (
        <div id="mobile-menu" className="mobile-menu page-shell">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
              <ArrowRight />
            </Link>
          ))}
          <Link href="/login">
            Log in <ArrowRight />
          </Link>
        </div>
      )}
    </header>
  );
}
export function FinalCta() {
  return (
    <section className="final-section">
      <div className="final-trace" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <Reveal className="page-shell final-content">
        <div className="final-mark">
          <TraceMark />
        </div>
        <h2>Stop guessing what your agent did.</h2>
        <p>Replay the failure. Prove the fix. Keep it fixed.</p>
        <div className="final-actions">
          <Button asChild size="lg" className="final-primary">
            <Link href="/register">
              Start investigating <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" className="final-secondary" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
        <div className="ready-line mono">
          <StatusDot tone="fixed" /> READY FOR THE NEXT FAILED RUN
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-shell footer-grid">
        <div>
          <Link className="wordmark" href="#top">
            <TraceMark />
            <span>REFORGE</span>
          </Link>
          <p>Controlled replay and regression testing for failed AI-agent runs.</p>
        </div>
        <div>
          <span className="mono footer-label">PRODUCT</span>
          <Link href="#product">Failure investigation</Link>
          <Link href="#workflow">Controlled replay</Link>
          <Link href="#teams">For teams</Link>
        </div>
        <div>
          <span className="mono footer-label">RESOURCES</span>
          <Link href="#docs">Documentation</Link>
          <Link href="/login">Log in</Link>
          <Link href="/register">Get started</Link>
        </div>
        <div className="footer-year mono">© 2026 REFORGE</div>
      </div>
    </footer>
  );
}
