export default function Home(): React.JSX.Element {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '(not set)';
  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold">Reforge</h1>
      <p className="mt-2">API base URL: {apiBaseUrl}</p>
    </main>
  );
}
