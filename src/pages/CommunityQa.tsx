import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { submitPublicForm } from "../lib/publicFormSubmit";
import { useHoneypot } from "../hooks/useHoneypot";
import { COMMUNITY_QUESTION_CATEGORIES, CONTACT_EMAIL } from "../lib/constants";
import type { CommunityQuestion, CommunityQuestionCategory } from "../lib/types";
import Button from "../components/Button";

const CATEGORY_LABEL: Record<CommunityQuestionCategory, string> = Object.fromEntries(
  COMMUNITY_QUESTION_CATEGORIES.map((c) => [c.value, c.label])
) as Record<CommunityQuestionCategory, string>;

export default function CommunityQa() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category");
  const isValidCategory = (v: string | null): v is CommunityQuestionCategory =>
    v === "publisher" || v === "business" || v === "marketing";

  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CommunityQuestionCategory | "all">(
    isValidCategory(initialCategory) ? initialCategory : "all"
  );

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<CommunityQuestionCategory>(
    isValidCategory(initialCategory) ? initialCategory : "business"
  );
  const [question, setQuestion] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { isLikelyBot, wrapperProps } = useHoneypot();

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.from("community_questions").select("*").eq("status", "published").order("answered_at", { ascending: false }).then(({ data }) => {
      setQuestions((data ?? []) as CommunityQuestion[]);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLikelyBot(website)) {
      setSubmitting(true);
      setTimeout(() => { setSubmitting(false); setSent(true); }, 400);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitPublicForm("community_qa", {
      category, question,
      asked_by_name: name.trim() || null,
      asked_by_email: email.trim() || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
    setQuestion("");
  }

  const visible = categoryFilter === "all" ? questions : questions.filter((q) => q.category === categoryFilter);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <Seo title="Community Q&A · ChatSched" description="Real questions from businesses and publishers, answered by the ChatSched team." />

      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Community</span>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h1 className="text-3xl md:text-4xl max-w-xl">Q&amp;A</h1>
        <Link to="/community" className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft hover:text-billboard-ink">← Community</Link>
      </div>
      <p className="text-billboard-inkSoft max-w-xl mb-8">Real questions from businesses and publishers, answered by the team.</p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategoryFilter("all")} className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${categoryFilter === "all" ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}>All</button>
          {COMMUNITY_QUESTION_CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCategoryFilter(c.value)} className={`font-mono text-xs font-semibold uppercase px-3 py-2 rounded border-2 border-billboard-ink transition ${categoryFilter === c.value ? "bg-billboard-yellow" : "bg-white hover:bg-billboard-paperDim"}`}>{c.label}</button>
          ))}
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 bg-billboard-yellow hover:-translate-y-0.5 transition">
          {showForm ? "Close" : "Ask a question"}
        </button>
      </div>

      {showForm && (
        <div className="border-[3px] border-billboard-ink rounded p-6 mb-10">
          {sent ? (
            <div className="text-center">
              <p className="font-bold mb-1">Question received.</p>
              <p className="text-sm text-billboard-inkSoft">If it's a good fit for the community, we'll answer it and post it here.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as CommunityQuestionCategory)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 bg-white">
                  {COMMUNITY_QUESTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Your question</label>
                <textarea required value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5 resize-y" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Name <span className="font-normal text-billboard-inkSoft">(optional)</span></label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email <span className="font-normal text-billboard-inkSoft">(optional, in case we follow up)</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-billboard-ink rounded px-3 py-2.5" />
                </div>
              </div>
              <div {...wrapperProps}>
                <label htmlFor="qa-website">Leave this field empty</label>
                <input id="qa-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {submitError && <p className="text-billboard-red text-xs font-semibold">{submitError}</p>}
              {!isSupabaseConfigured && <p className="text-xs text-billboard-inkSoft">The database isn't connected yet — email {CONTACT_EMAIL} instead.</p>}
              <Button type="submit" variant="primary" size="md" disabled={submitting || !isSupabaseConfigured} className="w-full">
                {submitting ? "Submitting…" : "Submit question"}
              </Button>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-billboard-inkSoft text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-10 text-center text-billboard-inkSoft">
          Nothing published in this category yet — be the first to ask.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((q) => (
            <div key={q.id} className="border-[3px] border-billboard-ink rounded p-5">
              <span className="inline-block font-mono text-[10px] font-semibold uppercase tracking-wider border-2 border-billboard-ink bg-billboard-paperDim px-2 py-0.5 rounded mb-3">{CATEGORY_LABEL[q.category]}</span>
              <h3 className="font-bold mb-2">{q.question}</h3>
              <p className="text-sm text-billboard-inkSoft whitespace-pre-wrap">{q.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
