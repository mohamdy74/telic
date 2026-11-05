import { createFileRoute } from "@tanstack/react-router";
import { Eye, Link2, Pencil, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { usePrefs } from "@/components/app/preferences";
import { formatDate, type Locale } from "@/lib/i18n";
import { filterNotes, mdToHtml, sortNotes } from "@/lib/notes";
import { notes as noteApi, useStore } from "@/lib/store";
import type { Note, Task } from "@/lib/types";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Tilth" },
      {
        name: "description",
        content: "Thoughts, plans and links — one calm place, always yours.",
      },
      { property: "og:title", content: "Notes — Tilth" },
      {
        property: "og:description",
        content: "Thoughts, plans and links — one calm place, always yours.",
      },
    ],
  }),
  component: NotesPage,
});

type Toast = { msg: string; undo?: (() => void) | undefined };

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";
const OUTLINE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-50";
const INPUT =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none";

function NotesPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allNotes = useStore((s) => s.notes);
  const allTasks = useStore((s) => s.tasks);
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (showNew) titleRef.current?.focus();
  }, [showNew]);

  // The command palette asks for a fresh note through sessionStorage.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("tilth.new-note") === "1") {
        window.sessionStorage.removeItem("tilth.new-note");
        setShowNew(true);
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);

  if (!ready) return <NotesSkeleton />;

  const live = allNotes.filter((n) => !n.deletedAt);
  const list = sortNotes(filterNotes(live, q));
  const liveTasks = allTasks.filter((x) => !x.deletedAt);

  const removeNote = (n: Note) => {
    noteApi.remove(n.id);
    if (expandedId === n.id) setExpandedId(null);
    setToast({
      msg: t.notes.deleted,
      undo: () => noteApi.update(n.id, { deletedAt: undefined }),
    });
  };

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.notes}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.notes.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.notes.body}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-72">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.notes.searchPlaceholder}
            aria-label={t.notes.searchPlaceholder}
            className={INPUT + " ps-9"}
          />
        </div>
        <button type="button" onClick={() => setShowNew(!showNew)} className={PRIMARY_BTN}>
          <Plus className="size-4" aria-hidden />
          {t.notes.newNote}
        </button>
      </div>

      {showNew && (
        <NewNoteForm
          titleRef={titleRef}
          tasks={liveTasks}
          onAdd={(input) => {
            noteApi.add(input);
            setShowNew(false);
            setQ("");
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {list.length === 0 ? (
        <EmptyState onAdd={() => setShowNew(true)} hasNotes={live.length > 0} />
      ) : (
        <ul className="mt-4 space-y-2">
          {list.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              tasks={liveTasks}
              locale={locale}
              linkedTitle={taskTitle(liveTasks, n.linkedTaskId)}
              expanded={expandedId === n.id}
              onExpand={() => setExpandedId(expandedId === n.id ? null : n.id)}
              onDelete={() => removeNote(n)}
            />
          ))}
        </ul>
      )}

      {toast && (
        <div
          role="status"
          className="animate-pop fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[90vw] items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-elevated md:bottom-6"
        >
          <span className="text-sm">{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              {t.notes.undo}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function taskTitle(tasks: Task[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  return tasks.find((x) => x.id === id)?.title;
}

/* ---------------- row ---------------- */

function NoteRow({
  note,
  tasks,
  locale,
  linkedTitle,
  expanded,
  onExpand,
  onDelete,
}: {
  note: Note;
  tasks: Task[];
  locale: Locale;
  linkedTitle: string | undefined;
  expanded: boolean;
  onExpand: () => void;
  onDelete: () => void;
}) {
  const { t } = usePrefs();
  const pinned = !!note.pinned;
  const preview = note.body.replace(/\s+/g, " ").trim().slice(0, 120);
  return (
    <li className="panel p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => noteApi.update(note.id, { pinned: !pinned })}
          aria-label={pinned ? t.notes.unpin : t.notes.pin}
          aria-pressed={pinned}
          className={
            "rounded-md p-1.5 transition-colors hover:bg-accent/40 " +
            (pinned ? "text-primary" : "text-muted-foreground")
          }
        >
          {pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-start"
        >
          <span className="block truncate font-medium">
            {note.title || t.notes.untitled}
            {pinned && (
              <span className="ms-2 align-middle text-xs font-normal text-primary">{t.notes.pinned}</span>
            )}
          </span>
          {preview && (
            <span className="mt-0.5 block truncate text-sm text-muted-foreground" dir="auto">
              {preview}
            </span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDate(locale, new Date(note.updatedAt), { dateStyle: "medium" })}</span>
            {linkedTitle && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                <Link2 className="size-3" aria-hidden />
                <span className="max-w-40 truncate">{linkedTitle}</span>
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label={t.notes.edit}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.notes.delete}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {expanded && <NoteEditor note={note} tasks={tasks} onDone={onExpand} onDelete={onDelete} />}
    </li>
  );
}

/* ---------------- editor ---------------- */

function NoteEditor({
  note,
  tasks,
  onDone,
  onDelete,
}: {
  note: Note;
  tasks: Task[];
  onDone: () => void;
  onDelete: () => void;
}) {
  const { t } = usePrefs();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [linkedTaskId, setLinkedTaskId] = useState(note.linkedTaskId ?? "");
  const [preview, setPreview] = useState(false);
  const valid = title.trim() !== "";

  const save = () => {
    if (!valid) return;
    noteApi.update(note.id, {
      title: title.trim(),
      body,
      linkedTaskId: linkedTaskId || undefined,
      pinned: note.pinned,
    });
    onDone();
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t.notes.titlePlaceholder}
        aria-label={t.notes.title}
        className={INPUT}
        dir="auto"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="segmented m-0" role="radiogroup" aria-label={t.notes.body}>
          <button
            type="button"
            role="radio"
            aria-checked={!preview}
            onClick={() => setPreview(false)}
            className="segment"
          >
            {t.notes.write}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={preview}
            onClick={() => setPreview(true)}
            className="segment"
          >
            <Eye className="size-3.5" aria-hidden />
            {t.notes.preview}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">{t.notes.linkedTask}</span>
          <select
            value={linkedTaskId}
            onChange={(e) => setLinkedTaskId(e.target.value)}
            aria-label={t.notes.linkedTask}
            className="h-9 max-w-48 rounded-md border border-border bg-background px-2 text-sm outline-none"
          >
            <option value="">{t.notes.none}</option>
            {tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview ? (
        <div
          className="min-h-24 rounded-md border border-border bg-background p-3 text-sm"
          dir="auto"
          aria-label={t.notes.preview}
        >
          {body.trim() === "" ? (
            <p className="text-muted-foreground">{t.notes.bodyPlaceholder}</p>
          ) : (
            <div
              className="[&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_code]:rounded [&_code]:bg-accent/50 [&_code]:px-1 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_p]:leading-6 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: mdToHtml(body) }}
            />
          )}
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.notes.bodyPlaceholder}
          aria-label={t.notes.body}
          dir="auto"
          rows={6}
          className="w-full rounded-md border border-border bg-background p-3 text-sm outline-none"
        />
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onDelete} className="text-sm text-muted-foreground hover:text-destructive">
          {t.notes.delete}
        </button>
        <button type="button" onClick={onDone} className={OUTLINE_BTN}>
          {t.notes.cancel}
        </button>
        <button type="button" onClick={save} disabled={!valid} className={PRIMARY_BTN}>
          {t.notes.save}
        </button>
      </div>
    </div>
  );
}

/* ---------------- create ---------------- */

function NewNoteForm({
  titleRef,
  tasks,
  onAdd,
  onCancel,
}: {
  titleRef: RefObject<HTMLInputElement | null>;
  tasks: Task[];
  onAdd: (input: { title: string; body: string; linkedTaskId?: string | undefined }) => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const valid = title.trim() !== "";
  return (
    <form
      className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onAdd({ title: title.trim(), body, linkedTaskId: linkedTaskId || undefined });
      }}
    >
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t.notes.titlePlaceholder}
        aria-label={t.notes.title}
        className={INPUT}
        dir="auto"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.notes.bodyPlaceholder}
        aria-label={t.notes.body}
        dir="auto"
        rows={4}
        className="w-full rounded-md border border-border bg-background p-3 text-sm outline-none"
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="whitespace-nowrap">{t.notes.linkedTask}</span>
        <select
          value={linkedTaskId}
          onChange={(e) => setLinkedTaskId(e.target.value)}
          aria-label={t.notes.linkedTask}
          className="h-9 max-w-48 rounded-md border border-border bg-background px-2 text-sm outline-none"
        >
          <option value="">{t.notes.none}</option>
          {tasks.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className={OUTLINE_BTN}>
          {t.notes.cancel}
        </button>
        <button type="submit" disabled={!valid} className={PRIMARY_BTN}>
          {t.notes.add}
        </button>
      </div>
    </form>
  );
}

/* ---------------- skeleton / empty ---------------- */

function NotesSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-16 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-56 animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-10 w-44 animate-pulse rounded-lg bg-accent/30" />
      <div className="mt-6 space-y-2">
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
      </div>
    </section>
  );
}

function EmptyState({ onAdd, hasNotes }: { onAdd: () => void; hasNotes: boolean }) {
  const { t } = usePrefs();
  return (
    <div className="empty-card mt-4">
      <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <StickyNote className="size-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{t.notes.emptyTitle}</p>
      <p className="text-sm text-muted-foreground">{t.notes.emptyLine}</p>
      {!hasNotes && (
        <button type="button" onClick={onAdd} className={PRIMARY_BTN}>
          {t.notes.newNote}
        </button>
      )}
    </div>
  );
}
