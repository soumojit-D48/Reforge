import Link from "next/link";

export default function Home(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8 font-sans">
      <h1 className="text-3xl font-bold">Reforge</h1>
      <p className="text-gray-600">
        AI agent failure investigation and replay workspace.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
        >
          Register
        </Link>
      </div>
    </main>
  );
}
