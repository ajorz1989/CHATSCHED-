import { useState } from "react";
import { Link } from "react-router-dom";
import { usePublishers } from "../../hooks/usePublishers";
import { PROVINCES } from "../../lib/constants";
import { runReachPlanner, type ReachPlannerResult } from "../../lib/marketingSuite";
import { formatCurrency } from "../../lib/currency";
import EmptyState from "../EmptyState";

const GOALS = [
  "Brand awareness",
  "Drive foot traffic",
  "Generate leads / enquiries",
  "Promote a sale or launch",
  "Grow social following",
];

type Step = "type" | "customer" | "location" | "budget" | "goal" | "results";

export default function ReachPlanner() {
  const { publishers, loading } = usePublishers();
  const [step, setStep] = useState<Step>("type");
  const [businessType, setBusinessType] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [campaignGoal, setCampaignGoal] = useState(GOALS[0]);
  const [result, setResult] = useState<ReachPlannerResult | null>(null);

  function nextFrom(current: Step) {
    const order: Step[] = ["type", "customer", "location", "budget", "goal", "results"];
    const i = order.indexOf(current);
    if (current === "goal") {
      const res = runReachPlanner(
        {
          businessType,
          targetCustomer,
          location,
          budget: budget ? Number(budget) : null,
          campaignGoal,
        },
        publishers
      );
      setResult(res);
      setStep("results");
      return;
    }
    setStep(order[i + 1]);
  }

  const inputClass = "w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
  const btnClass =
    "bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition disabled:opacity-60";

  if (step === "results" && result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-billboard-inkSoft">
            Rule-based plan from your answers. A smarter model can plug in later without changing this layout.
          </p>
          <button
            type="button"
            onClick={() => {
              setStep("type");
              setResult(null);
            }}
            className="text-xs font-semibold underline text-billboard-inkSoft"
          >
            Start over
          </button>
        </div>

        <section>
          <h3 className="font-display text-lg mb-3">Recommended publishers</h3>
          {result.matches.length === 0 ? (
            <div className="border-[3px] border-dashed border-billboard-ink rounded">
              <EmptyState
                kind="search"
                title="No strong matches"
                description={<>Try broader inputs, or <Link to="/browse" className="underline font-semibold">browse everyone</Link>.</>}
                compact
              />
            </div>
          ) : (
            <div className="space-y-3">
              {result.matches.map((m) => (
                <Link
                  key={m.publisher.id}
                  to={`/browse/${m.publisher.id}`}
                  className="block border-2 border-billboard-ink rounded p-4 bg-white hover:-translate-y-0.5 transition"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-bold text-sm">{m.publisher.name}</p>
                    <span className="font-mono text-[10px] font-bold uppercase bg-billboard-ink text-white px-2 py-1 rounded">
                      {m.score}% match
                    </span>
                  </div>
                  <p className="text-xs text-billboard-inkSoft mt-1">
                    ~{m.estimatedReach.toLocaleString()} reach · {m.engagement}% eng · {formatCurrency(m.publisher.price_per_post)}
                  </p>
                  <p className="text-xs text-billboard-inkSoft mt-1">{m.reasons.join(" · ")}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="border-2 border-billboard-ink rounded p-4">
            <h3 className="font-semibold text-sm mb-2">Posting schedule</h3>
            <ul className="text-sm text-billboard-inkSoft space-y-1 list-disc pl-4">
              {result.postingSchedule.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="border-2 border-billboard-ink rounded p-4">
            <h3 className="font-semibold text-sm mb-2">Budget allocation</h3>
            {result.budgetAllocation.length === 0 ? (
              <p className="text-sm text-billboard-inkSoft">Set a budget on the previous step for a split.</p>
            ) : (
              <ul className="text-sm text-billboard-inkSoft space-y-1">
                {result.budgetAllocation.map((b, i) => (
                  <li key={i}>
                    <span className="font-semibold text-billboard-ink">{b.publisherName}</span>
                    {" — "}{formatCurrency(b.suggested)} ({b.sharePct}%)
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs font-mono uppercase text-billboard-inkSoft mt-3">
              Combined est. reach ~{result.estimatedReach.toLocaleString()}
            </p>
          </div>
        </section>

        <div className="text-xs text-billboard-inkSoft space-y-1">
          {result.notes.map((n, i) => (
            <p key={i}>• {n}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded p-5 bg-billboard-paperDim max-w-lg">
      <p className="text-xs font-mono uppercase text-billboard-inkSoft mb-4">
        Step {["type", "customer", "location", "budget", "goal"].indexOf(step) + 1} of 5
      </p>

      {step === "type" && (
        <>
          <label className={labelClass}>Business type</label>
          <input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="e.g. Pizza shop, dental practice, gym"
            className={inputClass}
          />
          <button type="button" disabled={!businessType.trim()} onClick={() => nextFrom("type")} className={`${btnClass} mt-4`}>
            Continue
          </button>
        </>
      )}

      {step === "customer" && (
        <>
          <label className={labelClass}>Who is your target customer?</label>
          <textarea
            value={targetCustomer}
            onChange={(e) => setTargetCustomer(e.target.value)}
            rows={3}
            placeholder="e.g. Families in the southern suburbs, 25–45, who order takeaways on weekends"
            className={inputClass}
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={() => setStep("type")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" disabled={!targetCustomer.trim()} onClick={() => nextFrom("customer")} className={btnClass}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === "location" && (
        <>
          <label className={labelClass}>Location / area</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Umhlanga, Durban"
            className={`${inputClass} mb-3`}
            list="reach-planner-provinces"
          />
          <datalist id="reach-planner-provinces">
            {PROVINCES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setStep("customer")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" disabled={!location.trim()} onClick={() => nextFrom("location")} className={btnClass}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === "budget" && (
        <>
          <label className={labelClass}>Campaign budget (optional)</label>
          <input
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Total R for this campaign"
            className={inputClass}
          />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={() => setStep("location")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" onClick={() => nextFrom("budget")} className={btnClass}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === "goal" && (
        <>
          <label className={labelClass}>Campaign goal</label>
          <div className="space-y-2 mb-4">
            {GOALS.map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="goal"
                  checked={campaignGoal === g}
                  onChange={() => setCampaignGoal(g)}
                  className="accent-billboard-green"
                />
                {g}
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("budget")} className="font-bold px-4 py-2.5">
              Back
            </button>
            <button type="button" disabled={loading} onClick={() => nextFrom("goal")} className={btnClass}>
              {loading ? "Loading…" : "See recommendations"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
