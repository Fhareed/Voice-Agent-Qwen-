import Link from "next/link";

// Shown when a signed-in user who is NOT on the admin allowlist reaches the admin
// console. The data itself never leaves the backend (every /admin/* endpoint
// enforces the allowlist server-side) — this is just the friendly wall.
export default function AdminGate() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md rounded-[20px] border-2 border-ink bg-white p-8 text-center shadow-[4px_5px_0_#111827]">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Admin only</h1>
        <p className="mt-2 font-sans text-[14px] text-muted">
          This console is for the LumiDesk team. Your account isn&apos;t on the admin list.
        </p>
        <p className="mt-3 font-sans text-[12.5px] text-ink/50">
          To grant access, add your login email to{" "}
          <code className="rounded bg-cream px-1.5 py-0.5">ADMIN_EMAILS</code> in the backend{" "}
          <code className="rounded bg-cream px-1.5 py-0.5">.env</code>.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block rounded-full border-2 border-ink bg-ink px-5 py-2.5 font-display text-[14px] font-bold text-cream"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
