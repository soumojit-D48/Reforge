import type { CSSProperties, ReactNode } from "react";

export function TraceMark({ className = "" }: { className?: string }) {
  return (
    <span className={`trace-mark ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function StatusDot({ tone }: { tone: string }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
