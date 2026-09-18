import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { SkeletonLine } from "../components/Skeleton";
import { scanAndRedactMessage } from "../lib/messageSafety";
import { isMessageSafetyPrescanEnabled } from "../lib/featureFlags";
import type { Message, SenderRole } from "../lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function MessageThread({ requestId, channelRequestId, senderRole }: { requestId?: string; channelRequestId?: string; senderRole: SenderRole }) {
  const parentColumn = channelRequestId ? "channel_request_id" : "request_id";
  const parentId = channelRequestId ?? requestId;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [redactedNotice, setRedactedNotice] = useState(false);

  async function load() {
    if (!parentId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq(parentColumn, parentId)
      .order("created_at", { ascending: true });
    const loadedMessages = (data ?? []) as Message[];
    setMessages(loadedMessages);
    setLoaded(true);

    // Same "the thread is open, so it's been seen" signal as
    // Messages.tsx's conversation view — see schema_phase41 for the RLS
    // that keeps this from ever touching a message this viewer sent.
    const unreadFromOther = loadedMessages.filter((m) => m.sender_role !== senderRole && !m.read_at);
    if (unreadFromOther.length > 0) {
      supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadFromOther.map((m) => m.id))
        .then(() => {}, () => {});
    }
  }

  useEffect(() => {
    if (open && !loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Realtime, not polling (schema_phase45_realtime.sql) — only subscribed
  // while the thread is actually open, matching this component's existing
  // "only fetch once opened" behavior. Only needs to handle messages from
  // the OTHER party: this component's own send() already appends its own
  // message via the load() it calls right after inserting, so duplicating
  // that here would just be two code paths for the same result.
  useEffect(() => {
    if (!open || !parentId) return;
    const channel = supabase
      .channel(`messages:${parentColumn}:${parentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `${parentColumn}=eq.${parentId}` },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const row = payload.new as Message;
          if (row.sender_role === senderRole) return; // own message — the post-send load() already handled it
          setMessages((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
          // The thread is open right now, so this message is seen the
          // instant it arrives — same signal as load()'s own mark-as-read
          // for messages that were already there when it opened.
          supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", row.id).then(() => {}, () => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, parentColumn, parentId, senderRole]);

  async function send() {
    if (!body.trim() || !user || !parentId) return;
    setSending(true);
    const trimmed = body.trim();
    const prescan = isMessageSafetyPrescanEnabled() ? scanAndRedactMessage(trimmed) : null;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        [parentColumn]: parentId,
        sender_id: user.id,
        sender_role: senderRole,
        body: prescan ? prescan.body : trimmed,
        flagged: prescan?.flagged ?? false,
        flag_reason: prescan?.flagReason ?? null,
      })
      .select("flagged")
      .single();
    setSending(false);
    if (!error) {
      setBody("");
      // schema_phase57's trigger is the real authority — trust what it
      // actually stored, not just our own optimistic pre-scan, so the
      // notice is still correct with the prescan flag off.
      setRedactedNotice(data?.flagged ?? false);
      load();
      // Best-effort — a failed notification email shouldn't undo a message
      // that already sent successfully. The notify edge function only
      // understands request_id today (see supabase/functions/notify) —
      // generalizing it to channel_request_id is a separate, untested-here
      // change, so a channel thread message doesn't trigger an email yet;
      // it still sends and shows up in-app via the realtime subscription
      // above and read-receipt UI either way.
      if (requestId) {
        supabase.functions.invoke("notify", { body: { kind: "new_message", request_id: requestId } }).catch(() => {});
      }
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-xs font-semibold uppercase text-billboard-inkSoft underline"
      >
        {open ? "Hide messages" : `Messages${loaded && messages.length > 0 ? ` (${messages.length})` : ""}`}
      </button>

      {open && (
        <div className="mt-3 border-2 border-billboard-ink rounded p-3 bg-white">
          {!loaded ? (
            <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading messages">
              <div className="p-2.5 rounded border-2 border-billboard-ink bg-billboard-paperDim mr-6 flex flex-col gap-1.5">
                <SkeletonLine className="w-24 h-2" />
                <SkeletonLine className="w-40" />
              </div>
              <div className="p-2.5 rounded border-2 border-billboard-greenDeep bg-[#EAF3EC] ml-6 flex flex-col gap-1.5">
                <SkeletonLine className="w-24 h-2" />
                <SkeletonLine className="w-28" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-billboard-inkSoft mb-2">No messages yet — say hello below.</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
              {messages.map((m, i) => {
                const isMine = m.sender_role === senderRole;
                const isMyLastMessage = isMine && !messages.slice(i + 1).some((later) => later.sender_role === senderRole);
                return (
                  <div key={m.id}>
                    <div className={`text-sm p-2.5 rounded border-2 ${isMine ? "border-billboard-greenDeep bg-[#EAF3EC] ml-6" : "border-billboard-ink bg-billboard-paperDim mr-6"}`}>
                      <p className="font-mono text-[10px] uppercase text-billboard-inkSoft mb-1">
                        {m.sender_role === "admin" ? "Platform" : m.sender_role === "publisher" ? "Publisher" : "Business"} · {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p>{m.body}</p>
                    </div>
                    {isMyLastMessage && (
                      <p className="text-[10px] font-mono uppercase text-billboard-inkSoft text-right mr-1 mt-0.5">
                        {m.read_at ? "Seen" : "Sent"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (redactedNotice) setRedactedNotice(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Write a message…"
              className="flex-1 border-2 border-billboard-ink rounded px-3 py-2 text-sm"
            />
            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="border-2 border-billboard-ink font-bold px-4 rounded text-sm hover:-translate-y-0.5 transition disabled:opacity-60"
            >
              Send
            </button>
          </div>
          {redactedNotice && (
            <p className="text-[11px] font-mono text-billboard-inkSoft mt-1.5">
              We removed contact details from that message — keep chats on ChatSched so everything stays covered by Trust Centre protections.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
