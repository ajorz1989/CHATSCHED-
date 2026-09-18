import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useSavedLists, type SavedList } from "../contexts/SavedListsContext";
import { usePublishers } from "../hooks/usePublishers";
import {} from "../lib/publisherDisplay";
import TrustBadge from "../components/TrustBadge";
import { formatCurrency } from "../lib/currency";
import type { Publisher } from "../lib/types";
import Seo from "../components/Seo";
import { EmptyIllustration } from "../components/EmptyState";
import Button from "../components/Button";

const EXAMPLE_NAMES = ["Restaurant Campaign", "Property Campaign", "Christmas Campaign", "Back to School", "Summer Launch"];

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

function PublisherRow({ publisher, onRemove, listId }: { publisher: Publisher; onRemove: (listId: string, pubId: string) => void; listId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-t border-billboard-paperDim">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${publisher.swatch} border-2 border-billboard-ink flex items-center justify-center font-display text-xs shrink-0`}>
          {publisher.initials}
        </div>
        <div>
          <Link to={`/browse/${publisher.id}`} className="font-semibold text-sm hover:text-billboard-greenDeep transition">
            {publisher.name}
          </Link>
          <p className="text-xs text-billboard-inkSoft">{publisher.city} · {fmt(publisher.followers)} followers · {formatCurrency(publisher.price_per_post)}/post</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {publisher.level && (
          <span className="hidden sm:inline font-mono text-[10px] border border-billboard-ink rounded-full px-2 py-0.5 bg-billboard-paperDim">
            <TrustBadge kind="publisher" level={publisher.level} showLabel={false} />
          </span>
        )}
        <Link to={`/browse/${publisher.id}`} className="text-xs font-semibold border-2 border-billboard-ink px-2.5 py-1 rounded hover:-translate-y-0.5 transition">
          View
        </Link>
        <button
          onClick={() => onRemove(listId, publisher.id)}
          className="text-xs text-billboard-inkSoft hover:text-billboard-red transition font-semibold"
          title="Remove from list"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ListCard({ list, publishers, onDelete, onRename, onRemovePublisher }: {
  list: SavedList;
  publishers: Publisher[];
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemovePublisher: (listId: string, pubId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const listPublishers = list.publisherIds.map(id => publishers.find(p => p.id === id)).filter(Boolean) as Publisher[];

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) { onRename(list.id, name); setEditing(false); }
  }

  return (
    <div className="border-[3px] border-billboard-ink rounded bg-white overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={submitRename} className="flex gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 border-2 border-billboard-ink rounded px-2.5 py-1.5 text-sm font-bold bg-white"
                autoFocus
              />
              <button type="submit" className="border-[3px] border-billboard-ink font-bold text-sm px-3 py-1 rounded hover:-translate-y-0.5 transition">Save</button>
              <button type="button" onClick={() => { setEditing(false); setName(list.name); }} className="text-sm text-billboard-inkSoft underline">Cancel</button>
            </form>
          ) : (
            <h3 className="font-display text-lg leading-snug truncate">{list.name}</h3>
          )}
          <p className="text-xs text-billboard-inkSoft mt-1">
            {list.publisherIds.length} publisher{list.publisherIds.length !== 1 ? "s" : ""} · Created {new Date(list.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {/* Publisher initials preview */}
          {listPublishers.length > 0 && (
            <div className="flex gap-1.5 mt-2.5">
              {listPublishers.slice(0, 5).map(p => (
                <div key={p.id} className={`w-7 h-7 rounded-full bg-gradient-to-br ${p.swatch} border-2 border-billboard-ink flex items-center justify-center font-display text-[9px]`} title={p.name}>
                  {p.initials}
                </div>
              ))}
              {listPublishers.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-billboard-paperDim border-2 border-billboard-ink flex items-center justify-center text-[10px] font-bold text-billboard-inkSoft">
                  +{listPublishers.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(s => !s)}
            className="text-xs font-semibold border-2 border-billboard-ink px-3 py-1.5 rounded hover:-translate-y-0.5 transition"
          >
            {expanded ? "Collapse" : "View list"}
          </button>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-billboard-inkSoft hover:text-billboard-ink font-semibold" title="Rename">✎</button>
          )}
          {confirmDelete ? (
            <span className="flex items-center gap-1.5 text-xs">
              <button onClick={() => onDelete(list.id)} className="font-bold text-billboard-red underline">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-billboard-inkSoft underline">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-billboard-inkSoft hover:text-billboard-red transition" title="Delete list">🗑</button>
          )}
        </div>
      </div>

      {/* Expanded publisher list */}
      {expanded && (
        <div className="px-5 pb-5 border-t-2 border-billboard-paperDim">
          {listPublishers.length === 0 ? (
            <div className="py-8 text-center text-billboard-inkSoft text-sm">
              No publishers in this list yet. Browse and click "Save" to add some.
            </div>
          ) : (
            <div>
              {listPublishers.map(p => (
                <PublisherRow key={p.id} publisher={p} listId={list.id} onRemove={onRemovePublisher} />
              ))}
              <div className="mt-4 pt-4 border-t border-billboard-paperDim flex gap-3">
                <Link to="/browse" className="text-xs font-semibold border-2 border-billboard-ink px-3 py-1.5 rounded hover:-translate-y-0.5 transition">
                  + Add more publishers
                </Link>
                <Link
                  to={`/compare?ids=${list.publisherIds.slice(0, 5).join(",")}`}
                  className="text-xs font-semibold border-2 border-billboard-green text-billboard-green px-3 py-1.5 rounded hover:-translate-y-0.5 transition"
                >
                  ⊞ Compare these
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SavedLists() {
  const { lists, createList, deleteList, renameList, removeFromList } = useSavedLists();
  const { publishers } = usePublishers();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createList(newName);
    setNewName("");
    setShowCreate(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <Seo title="Saved Lists · ChatSched" description="Organise publishers into campaign shortlists like Restaurant Campaign, Property Launch, and more." />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Saved Lists</span>
          <h1 className="text-3xl md:text-4xl mb-2">Your publisher shortlists.</h1>
          <p className="text-billboard-inkSoft max-w-xl">
            {lists.length === 0
              ? "Create a list to organise publishers for a campaign."
              : `${lists.length} list${lists.length !== 1 ? "s" : ""} · ${lists.reduce((n, l) => n + l.publisherIds.length, 0)} total publishers saved.`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-5 py-2.5 rounded hover:-translate-y-0.5 transition"
        >
          {showCreate ? "Cancel" : "+ New list"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border-[3px] border-billboard-ink rounded p-6 mb-8 bg-billboard-paperDim">
          <h2 className="font-bold mb-4">Name your list</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={`e.g. ${EXAMPLE_NAMES[Math.floor(Math.random() * EXAMPLE_NAMES.length)]}`}
              className="flex-1 border-2 border-billboard-ink rounded px-3 py-2.5 bg-white text-sm"
              autoFocus
              maxLength={60}
            />
            <Button type="submit" variant="primary" size="md" disabled={!newName.trim()}>
              Create list
            </Button>
          </form>
          <p className="text-xs text-billboard-inkSoft mt-2">Lists are saved to your browser — no account needed.</p>
        </div>
      )}

      {/* List grid */}
      {lists.length === 0 ? (
        <div className="border-[3px] border-dashed border-billboard-ink rounded p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4"><EmptyIllustration kind="list" /></div>
          <h2 className="text-xl mb-2">No lists yet</h2>
          <p className="text-billboard-inkSoft mb-6 max-w-sm mx-auto">
            Create a list, then browse publishers and click "Save" to add them to it. Great for organising shortlists by campaign.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {EXAMPLE_NAMES.map(n => (
              <button key={n} onClick={() => { createList(n); }} className="border-2 border-billboard-ink rounded-full font-mono text-xs px-3 py-1.5 hover:bg-billboard-paperDim transition">
                {n}
              </button>
            ))}
          </div>
          <Link to="/browse" className="inline-flex items-center gap-2 bg-billboard-yellow border-[3px] border-billboard-ink font-bold px-6 py-3 rounded hover:-translate-y-0.5 transition">
            Browse publishers →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map(list => (
            <ListCard
              key={list.id}
              list={list}
              publishers={publishers}
              onDelete={deleteList}
              onRename={renameList}
              onRemovePublisher={removeFromList}
            />
          ))}
        </div>
      )}
    </div>
  );
}
