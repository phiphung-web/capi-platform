import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">CAPI Platform</h1>
        <p className="text-slate-400">Dev/Admin console</p>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
        >
          Go to Login
        </Link>
      </div>
    </main>
  );
}
