"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminOrg, Settings } from "@/lib/api";
import { CARD, fmtDate, Label } from "./ui";

const BASE_KEY = "ld_admin_base_url";
const WIRED_KEY = "ld_admin_wired";

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setVal(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };
  return [val, set];
}

function CopyButton({ text, label = "Copy", small = false }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className={`shrink-0 rounded-full border-2 font-display font-bold transition-colors ${
        small ? "px-3 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]"
      } ${done ? "border-mint bg-mint/15 text-[#0E8F63]" : "border-ink/20 bg-white text-ink hover:border-ink"}`}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function str(s: Settings, k: string, d = ""): string {
  const v = s[k];
  return typeof v === "string" && v.trim() ? v : d;
}

function formatHours(s: Settings): string {
  if (s.always_open === true) return "Answers 24/7, any hour.";
  const hours = (s.hours as Record<string, { open?: boolean; from?: string; to?: string }>) || {};
  const order: [string, string][] = [
    ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
  ];
  return order
    .map(([k, label]) => {
      const h = hours[k];
      if (!h || !h.open) return `${label} closed`;
      return `${label} ${h.from || "09:00"}–${h.to || "17:00"}`;
    })
    .join(", ");
}

function genPrompt(o: AdminOrg): string {
  const s = o.settings || {};
  const name = str(s, "business_name", o.name || "the business");
  const industry = str(s, "industry", "local service").toLowerCase();
  const lang = str(s, "default_language", "English");
  const agent = "Mari";
  const hours = formatHours(s);
  const langNote = str(s, "languages_note");
  const extraLang = langNote ? `\n- If the caller speaks another language, you may also help in: ${langNote}.` : "";
  const services = str(s, "services", "«FILL IN — your main services»");
  const pricing = str(s, "pricing", "«FILL IN — your call-out fee and hourly rate»");
  const area = str(s, "service_area", "«FILL IN — the area you cover»");

  return `IDENTITY
You're the receptionist for ${name}, a ${industry} business. You're on a live phone call. Your name is ${agent}. You sound warm, calm, and real — never scripted, never robotic. You exist so no call is ever missed.

LANGUAGE
- Speak ${lang} for the whole call, including after every tool call.${extraLang}
- One short, natural spoken sentence per reply. Never read long lists aloud.

HOW YOU TALK (sound human, not like an AI)
- One short sentence, two at most. Always use contractions (I'll, you're, that's).
- Don't repeat back what they said. "Tuesday at 8, perfect" — not "So you'd like Tuesday at 8am, correct?"
- Little fillers are good: "sure", "let me check", "one sec", "got it". React like a person: "oh no", "yeah, totally".
- Use pauses on purpose — a dash or "…" makes you sound like you're thinking.
- Vary your wording; never reuse the same greeting or confirmation twice in a call.
- Never say: "How may I assist you", "I'd be happy to assist you", "Is there anything else I can help you with today".
- Never say tool names, org IDs, or anything technical out loud.

OPENING
Open warm and short, e.g. "${name}, this is ${agent} — how can I help?" (vary it slightly each call). If the caller opens with small talk ("hi, how's it going?"), answer it warmly first before moving to business.

MEMORY (never ask twice)
- You already have whatever the caller gave you — name, number, the problem, the time. Never ask for any of it again.
- If you genuinely missed one thing, ask only for that one thing, casually.

BUSINESS INFO (only use what's here — never invent anything)
- Services: ${services}
- Hours: ${hours}
- Service area: ${area}
- Pricing: ${pricing} (say it casually; for anything not listed, a team member will confirm)

HANDLING THE CALL
- Greet, then just answer what they ask — don't interrogate.
- Emergencies: stay calm, reassure them, treat it as urgent, offer the soonest time.
- To book: get their name, number, and a rough when — conversationally. Call check_availability, offer one or two real times, then call book_appointment with the exact iso start. Confirm warmly in one sentence.
- If you don't know something, say so and offer to take a message.

IF A TOOL IS SLOW OR FAILS
- Never go silent and never invent a time. Cover it naturally ("one sec, still checking…") and try once more. If it still won't load, take their name and number and say someone will confirm shortly.

TOOLS
- check_availability(org_id, service) — always call before offering a time.
- book_appointment(org_id, start, customer_name, customer_phone, service) — book a chosen time.
- send_sms(org_id, to, message) — optional.
- On EVERY tool call, pass org_id = "${o.org_id}". Keep speaking ${lang} after any tool call.`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[108px] shrink-0 font-display text-[11.5px] font-bold uppercase tracking-wide text-ink/50">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/10 bg-cream px-2.5 py-1.5 font-mono text-[12.5px] text-ink">
        {value}
      </code>
      <CopyButton text={value} small />
    </div>
  );
}

function OrgCard({ org, baseUrl, wired, toggleWired }: { org: AdminOrg; baseUrl: string; wired: boolean; toggleWired: () => void }) {
  const s = org.settings || {};
  const title = str(s, "business_name", org.name || "Untitled business");
  const email = str(s, "contact_email") || org.owner_email || "—";
  const phone = str(s, "phone_number", "—");
  const created = fmtDate(org.created_at);
  const base = (baseUrl || "«set your ngrok URL above»").replace(/\/+$/, "");
  const prompt = useMemo(() => genPrompt(org), [org]);

  const [prov, setProv] = useState<{ loading: boolean; agentId?: string; next?: string; error?: string }>({ loading: false });
  async function provision() {
    setProv({ loading: true });
    try {
      const res = await fetch("/api/admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.org_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProv({ loading: false, error: data.error || "Provisioning failed." });
        return;
      }
      setProv({ loading: false, agentId: data.agent_id, next: data.next });
    } catch {
      setProv({ loading: false, error: "Couldn't reach the server." });
    }
  }

  const tools = [
    ["check_availability", `${base}/tools/check_availability`],
    ["book_appointment", `${base}/tools/book_appointment`],
    ["send_sms", `${base}/tools/send_sms`],
    ["post-call webhook", `${base}/retell/webhook/YOUR_WEBHOOK_SECRET`],
  ];

  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
          <p className="mt-0.5 font-sans text-[12.5px] text-muted">
            {email} · {phone} · signed up {created} · {org.calls} calls · {org.bookings} bookings
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-2 border-ink/20 px-3 py-1.5">
          <input type="checkbox" checked={wired} onChange={toggleWired} className="h-4 w-4 accent-[#2F6BFF]" />
          <span className={`font-display text-[12.5px] font-bold ${wired ? "text-[#0E8F63]" : "text-ink/60"}`}>
            {wired ? "Wired in Retell" : "Mark wired"}
          </span>
        </label>
      </div>

      <div className="mt-4 rounded-2xl border-2 border-ink bg-cobalt/[0.06] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-[14px] font-bold text-ink">Provision automatically</div>
            <div className="font-sans text-[12.5px] text-muted">Creates the Retell agent (prompt + tools + voice) for this business in one click.</div>
          </div>
          <button
            type="button"
            onClick={provision}
            disabled={prov.loading}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-cobalt px-4 py-2 font-display text-[13px] font-bold text-cream transition-all hover:shadow-[4px_5px_0_#111827] disabled:opacity-50"
          >
            {prov.loading ? "Provisioning…" : prov.agentId ? "Re-provision" : "Provision in Retell"}
          </button>
        </div>
        {prov.agentId && (
          <div className="mt-2.5 rounded-lg border border-mint/40 bg-mint/10 px-3 py-2 font-sans text-[12.5px] text-[#0E8F63]">
            <span className="font-bold">Agent created:</span> <code className="font-mono text-ink">{prov.agentId}</code>
            {prov.next && <div className="mt-1 text-ink">{prov.next}</div>}
          </div>
        )}
        {prov.error && (
          <div className="mt-2.5 rounded-lg border border-flame/30 bg-flame/10 px-3 py-2 font-sans text-[12.5px] font-semibold text-ink">{prov.error}</div>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        <Label>Or wire it by hand</Label>
        <Field label="Org ID" value={org.org_id} />
        {tools.map(([label, url]) => (
          <Field key={label} label={label} value={url} />
        ))}
        <div className="flex items-center gap-2">
          <span className="w-[108px] shrink-0 font-display text-[11.5px] font-bold uppercase tracking-wide text-ink/50">tool header</span>
          <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/10 bg-cream px-2.5 py-1.5 font-mono text-[12.5px] text-ink">
            X-LumiDesk-Secret: &lt;your TOOLS_SHARED_SECRET&gt;
          </code>
          <CopyButton text="X-LumiDesk-Secret" small />
        </div>
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border-2 border-ink/10 bg-cream px-4 py-2.5">
          <span className="font-display text-[13.5px] font-bold text-ink">Receptionist prompt (pre-filled)</span>
          <span className="font-display text-[12px] font-bold text-cobalt group-open:hidden">Show</span>
          <span className="hidden font-display text-[12px] font-bold text-cobalt group-open:inline">Hide</span>
        </summary>
        <div className="mt-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-sans text-[12px] text-muted">Fill the «…» placeholders (services, area, pricing), then paste as the agent&apos;s prompt.</span>
            <CopyButton text={prompt} label="Copy prompt" />
          </div>
          <textarea
            readOnly
            value={prompt}
            className="h-64 w-full resize-y rounded-xl border-2 border-ink/15 bg-white p-3 font-mono text-[12px] leading-relaxed text-ink"
          />
        </div>
      </details>
    </section>
  );
}

export default function BusinessesView({ orgs, loadError }: { orgs: AdminOrg[]; loadError?: boolean }) {
  const [baseUrl, setBaseUrl] = useLocal<string>(BASE_KEY, "");
  const [wiredMap, setWiredMap] = useLocal<Record<string, boolean>>(WIRED_KEY, {});
  const toggleWired = (id: string) => setWiredMap({ ...wiredMap, [id]: !wiredMap[id] });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-ink">Businesses</h1>
          <p className="mt-1 font-sans text-[14px] text-muted">
            {orgs.length} business{orgs.length === 1 ? "" : "es"} signed up — wire each into Retell.
          </p>
        </div>
        <label className="flex items-center gap-2">
          <span className="font-display text-[12px] font-bold uppercase tracking-wide text-ink/50">ngrok base URL</span>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://xxxx.ngrok-free.app"
            className="w-[220px] rounded-full border-2 border-ink/20 bg-white px-3.5 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:border-ink"
          />
        </label>
      </div>

      {loadError && (
        <p className="rounded-xl border-2 border-ink bg-flame/10 px-3 py-2 font-sans text-[13px] font-semibold text-ink">
          Couldn&apos;t load businesses just now. Is the backend running?
        </p>
      )}

      {orgs.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-ink/30 bg-white px-6 py-14 text-center">
          <p className="font-display text-[17px] font-bold text-ink">No businesses yet</p>
          <p className="mt-1 font-sans text-[13.5px] text-muted">When someone signs up, they&apos;ll show up here with everything you need to wire them in.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {orgs.map((o) => (
            <OrgCard key={o.org_id} org={o} baseUrl={baseUrl} wired={!!wiredMap[o.org_id]} toggleWired={() => toggleWired(o.org_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
