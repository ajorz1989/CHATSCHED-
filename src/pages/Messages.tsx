import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { formatSupabaseError } from "../lib/supabaseErrors";
import { fetchBusinessContacts } from "../lib/businessContact";
import { scanAndRedactMessage } from "../lib/messageSafety";
import { isMessageSafetyPrescanEnabled } from "../lib/featureFlags";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";
import { SkeletonBlock, SkeletonLine } from "../components/Skeleton";
import type { Conversation, ConversationMessage, SenderRole } from "../lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function counterpartName(c: Conversation, viewerRole: SenderRole | undefined): string {
  if (viewerRole === "publisher") {
    return c.business?.company_name || c.business?.full_name || "A business";
  }
  return c.publisher?.name || "Publisher";
}

function counterpartInitials(c: Conversation, viewerRole: SenderRole | undefined): string {
  if (viewerRole === "publisher") {
    const name = c.business?.company_name || c.business?.full_name || "B";
    return name.slice(0, 2).toUpperCase();
  }
  return c.publisher?.initials || "P";
}

export default function Messages() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationParam = searchParams.get("c");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(conversationParam);

  const viewerRole: SenderRole | undefined =
    profile?.role === "publisher" ? "publisher" : profile?.role === "admin" ? "admin" : profile?.role === "business" ? "business" : undefined;

  async function loadList() {
    if (!user) return;
    // business:profiles!business_id(...) used to be embedded directly here
    // — same profiles_select_via_shared_conversation over-exposure as
    // PublisherDashboardView.tsx (see src/lib/businessContact.ts). Fetch
    // conversations first, then resolve the safe business contact
    // separately for whichever business ids came back.
    const { data, error } = await supabase
      .from("conversations")
      .select("*, publisher:publishers(id, name, initials, city, province, swatch)")
      .order("last_message_at", { ascending: false });
    if (error) setListError(formatSupabaseError(error, "Couldn't load your conversations"));
    else {
      setListError(null);
      const rows = (data ?? []) as unknown as Conversation[];
      const contacts = await fetchBusinessContacts(rows.map((r) => r.business_id));
      setConversations(rows.map((r) => ({ ...r, business: contacts.get(r.business_id) ?? null })));
    }
    setLoadingList(false);
  }

  useEffect(() => {
    if (!user) return;
    loadList();

    // Realtime, not polling (schema_phase45_realtime.sql). No `filter`
    // here on purpose — this table's SELECT policy covers both business
    // participants (business_id = auth.uid()) and publisher participants
    // (via a join on publishers.user_id), which a single column-equality
    // filter can't express in one subscription. RLS still governs what
    // actually arrives; skipping the filter here means "let RLS decide,"
    // not "skip the security check" — see that migration's header for the
    // full reasoning. On any change to a conversation this user can see,
    // just reload the list — cheap, and simpler than hand-merging a
    // reordered/updated row into local state for a list this size.
    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadList())
      .subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") loadList();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (conversationParam) setActiveId(conversationParam);
  }, [conversationParam]);

  function selectConversation(id: string) {
    setActiveId(id);
    setSearchParams({ c: id }, { replace: true });
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="max-w-5xl mx-auto px-5 py-16">
      <Seo title="Messages · ChatSched" noindex />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">
        ChatSched Messages
      </span>
      <h1 className="text-3xl md:text-4xl mb-2">Messages</h1>
      <p className="text-billboard-inkSoft mb-8">
        Direct notes from the ChatSched team. Campaign-specific chat with a publisher or business happens inside that campaign's workspace, not here.
      </p>

      <div className="grid md:grid-cols-[280px_1fr] border-[3px] border-billboard-ink rounded overflow-hidden min-h-[480px] bg-white">
        <aside className={`border-b-[3px] md:border-b-0 md:border-r-[3px] border-billboard-ink bg-billboard-paperDim ${activeId ? "hidden md:block" : ""}`}>
          {loadingList ? (
            <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading conversations">
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
            </div>
          ) : listError ? (
            <p className="p-4 text-sm text-billboard-red font-semibold">{listError}</p>
          ) : conversations.length === 0 ? (
            <EmptyState
              kind="inbox"
              title="No messages yet"
              description="Messages from the ChatSched team will show up here. For campaign chat with a publisher or business, open the campaign from your dashboard."
              compact
              action={
                <Link to="/dashboard" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink font-bold px-4 py-2 rounded text-sm hover:-translate-y-0.5 transition bg-white">
                  Go to dashboard
                </Link>
              }
            />
          ) : (
            <ul>
              {conversations.map((c) => {
                const selected = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => selectConversation(c.id)}
                      className={`w-full text-left px-4 py-3 border-b border-billboard-ink/10 last:border-b-0 hover:bg-white transition ${selected ? "bg-white" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-9 h-9 rounded-full border-2 border-billboard-ink flex items-center justify-center font-display text-[10px] shrink-0 ${c.publisher?.swatch ? `bg-gradient-to-br ${c.publisher.swatch}` : "bg-billboard-yellow"}`}>
                          {counterpartInitials(c, viewerRole)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{counterpartName(c, viewerRole)}</p>
                          <p className="text-xs text-billboard-inkSoft truncate">
                            {c.last_message_preview || "No messages yet"}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={!activeId ? "hidden md:flex md:items-center md:justify-center" : "flex flex-col min-h-[480px]"}>
          {!activeId ? (
            <p className="text-sm text-billboard-inkSoft p-8 text-center">Pick a conversation to read it.</p>
          ) : (
            <Thread
              conversationId={activeId}
              conversation={active}
              viewerRole={viewerRole ?? "business"}
              onBack={() => {
                setActiveId(null);
                setSearchParams({}, { replace: true });
              }}
              onSent={loadList}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  conversationId,
  conversation,
  viewerRole,
  onBack,
  onSent,
}: {
  conversationId: string;
  conversation: Conversation | null;
  viewerRole: SenderRole;
  onBack: () => void;
  onSent: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [redactedNotice, setRedactedNotice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    const loadedMessages = (data ?? []) as ConversationMessage[];
    setMessages(loadedMessages);
    setLoaded(true);

    // Mark the other person's unread messages as seen — this thread is
    // open and visible, which is the actual "have they seen it" signal.
    // Fire-and-forget: RLS already stops this from ever touching a
    // message this viewer sent themselves (see
    // conversation_messages_update_mark_read in schema_phase41), so
    // there's nothing to validate client-side first.
    const unreadFromOther = loadedMessages.filter((m) => m.sender_role !== viewerRole && !m.read_at);
    if (unreadFromOther.length > 0) {
      supabase
        .from("conversation_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadFromOther.map((m) => m.id))
        .then(() => {}, () => {});
    }
  }

  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Realtime, not polling (schema_phase45_realtime.sql) — same shape as
  // MessageThread.tsx's subscription: only handles the other party's
  // messages, since send() below already appends this viewer's own
  // message via the load() it calls right after inserting.
  useEffect(() => {
    const channel = supabase
      .channel(`conversation_messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload: RealtimePostgresChangesPayload<ConversationMessage>) => {
          const row = payload.new as ConversationMessage;
          if (row.sender_role === viewerRole) return;
          setMessages((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
          supabase.from("conversation_messages").update({ read_at: new Date().toISOString() }).eq("id", row.id).then(() => {}, () => {});
        }
      )
      .subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerRole]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!body.trim() || !user) return;
    setSending(true);
    setSendError(null);
    const trimmed = body.trim();
    const prescan = isMessageSafetyPrescanEnabled() ? scanAndRedactMessage(trimmed) : null;
    const { data, error } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: viewerRole,
        body: prescan ? prescan.body : trimmed,
        flagged: prescan?.flagged ?? false,
        flag_reason: prescan?.flagReason ?? null,
      })
      .select("flagged")
      .single();
    setSending(false);
    if (error) {
      setSendError("Couldn't send that — try again in a moment.");
      return;
    }
    setBody("");
    // schema_phase57's trigger is the real authority, same reasoning as
    // MessageThread.tsx — trust the returned row, not just our own scan.
    setRedactedNotice(data?.flagged ?? false);
    await load();
    onSent();
  }

  const title =
    viewerRole === "publisher"
      ? conversation?.business?.company_name || conversation?.business?.full_name || "Business"
      : conversation?.publisher?.name || "Publisher";

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-billboard-ink bg-billboard-paperDim">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden text-xs font-semibold underline text-billboard-inkSoft"
        >
          ← Inbox
        </button>
        <h2 className="font-bold text-sm truncate flex-1">{title}</h2>
        {conversation?.publisher && viewerRole !== "publisher" && (
          <Link to={`/browse/${conversation.publisher.id}`} className="text-[10px] font-mono uppercase text-billboard-inkSoft underline shrink-0">
            View listing
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-h-[420px]">
        {!loaded ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading messages">
            <div className="p-2.5 rounded border-2 border-billboard-ink bg-billboard-paperDim mr-6 flex flex-col gap-1.5">
              <SkeletonLine className="w-24 h-2" />
              <SkeletonLine className="w-40" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-billboard-inkSoft">No messages yet — say hello below. This stays on ChatSched.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => {
              const isMine = m.sender_role === viewerRole;
              const isMyLastMessage = isMine && !messages.slice(i + 1).some((later) => later.sender_role === viewerRole);
              return (
                <div key={m.id}>
                  <div
                    className={`text-sm p-2.5 rounded border-2 ${
                      isMine
                        ? "border-billboard-greenDeep bg-[#EAF3EC] ml-6"
                        : "border-billboard-ink bg-billboard-paperDim mr-6"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">
                      {m.sender_role === "admin" ? "Platform" : m.sender_role === "publisher" ? "Publisher" : "Business"} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                  {isMyLastMessage && (
                    <p className="text-[10px] font-mono uppercase text-billboard-inkSoft text-right mr-1 mt-0.5">
                      {m.read_at ? "Seen" : "Sent"}
                    </p>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="p-3 border-t-2 border-billboard-ink">
        {sendError && <p className="text-billboard-red text-xs font-semibold mb-2">{sendError}</p>}
        {redactedNotice && (
          <p className="text-[11px] font-mono text-billboard-inkSoft mb-2">
            We removed contact details from that message — keep chats on ChatSched so everything stays covered by Trust Centre protections.
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (redactedNotice) setRedactedNotice(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Write a message…"
            maxLength={4000}
            className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="border-2 border-billboard-ink font-bold px-4 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60 bg-billboard-yellow"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
