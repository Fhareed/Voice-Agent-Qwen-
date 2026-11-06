import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL } from "@/lib/legalContent";

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const doc = LEGAL[params.slug];
  return { title: doc ? `${doc.title} — LumiDesk` : "LumiDesk" };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = LEGAL[params.slug];
  if (!doc) notFound();
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
        <Link href="/" className="font-sans text-[14px] font-bold text-ink underline underline-offset-2">
          ← Back to home
        </Link>
        <article className="legal-doc mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <div className="mt-12 border-t-2 border-ink/15 pt-6 font-sans text-[13px] text-muted">
          <Link href="/legal/privacy" className="mr-4 underline underline-offset-2">Privacy</Link>
          <Link href="/legal/terms" className="mr-4 underline underline-offset-2">Terms</Link>
          <Link href="/legal/dpa" className="mr-4 underline underline-offset-2">DPA</Link>
          <Link href="/legal/subprocessors" className="mr-4 underline underline-offset-2">Sub-processors</Link>
          <Link href="/legal/cookies" className="mr-4 underline underline-offset-2">Cookies</Link>
          <Link href="/legal/security" className="mr-4 underline underline-offset-2">Security</Link>
          <Link href="/legal/imprint" className="mr-4 underline underline-offset-2">Imprint</Link>
          <Link href="/legal/contact" className="underline underline-offset-2">Contact</Link>
        </div>
      </div>
    </div>
  );
}
