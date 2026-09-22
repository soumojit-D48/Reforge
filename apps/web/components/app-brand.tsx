import Link from "next/link";

export function AppBrand({ href = "/orgs" }: { href?: string }): React.JSX.Element {
  return (
    <Link className="app-brand" href={href}>
      <span className="app-brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>REFORGE</span>
    </Link>
  );
}
