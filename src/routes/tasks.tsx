import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  List,
  ListChecks,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefs } from "@/components/app/preferences";
import { weekdayOf } from "@/lib/dates";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { parseQuickAdd } from "@/lib/quickAdd";
import { tasks as taskApi, todayLocal, useStore } from "@/lib/store";
import type { Priority, RecurrenceRule, Task, TaskStatus } from "@/lib/types";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Tilth" },
      { name: "description", content: "Capture, prioritize and finish tasks with Today, Upcoming and Kanban views." },
      { property: "og:title", content: "Tasks — Tilth" },
      { property: "og:description", content: "Capture, prioritize and finish tasks with Today, Upcoming and Kanban views." },
    ],
  }),
  component: TasksPage,
});

type ViewKey = "today" | "upcoming" | "overdue" | "completed" | "inbox";
type Mode = "list" | "board";
type Toast = { msg: string; undo?: (() => void) | undefined };

const VIEWS: ViewKey[] = ["today", "upcoming", "overdue", "completed", "inbox"];
const PRIORITIES: Priority[] = ["low", "medium", "high"];
const STS: TaskStatus[] = ["todo", "doing", "done"];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const PRIO_CLS: Record<Priority, string> = { high: "bg-destructive", medium: "bg-primary", low: "bg-muted-foreground" };

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";
const OUTLINE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-50";
const DANGER_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50";

function TasksPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allTasks = useStore((s) => s.tasks);
  const [view, setView] = useState<ViewKey>("today");
  const [mode, setMode] = useState<Mode>("list");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seriesTask, setSeriesTask] = useState<Task | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the quick-add input when arriving via ⌘K → "New task".
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("tilth.new-task") === "1") {
        window.sessionStorage.removeItem("tilth.new-task");
        inputRef.current?.focus();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!ready) return <TasksSkeleton />;

  const today = todayLocal();
  const live = allTasks.filter((x) => !x.deletedAt);
  const allTags = [...new Set(live.flatMap((x) => x.tags))].sort();

  const q = search.trim().toLowerCase();
  const filtered = live.filter(
    (x) =>
      (priorityFilter === "all" || x.priority === priorityFilter) &&
      (tagFilter === "all" || x.tags.includes(tagFilter)) &&
      (q === "" ||
        x.title.toLowerCase().includes(q) ||
        (x.notes ?? "").toLowerCase().includes(q) ||
        x.tags.some((g) => g.includes(q))),
  );

  // Views bucket purely from the stored localDay vs today — never recomputed.
  const byView: Record<ViewKey, Task[]> = { today: [], upcoming: [], overdue: [], completed: [], inbox: [] };
  for (const x of filtered) {
    if (x.status === "done") byView.completed.push(x);
    else if (!x.dueDate) byView.inbox.push(x);
    else if (x.dueDate < today) byView.overdue.push(x);
    else if (x.dueDate === today) byView.today.push(x);
    else byView.upcoming.push(x);
  }
  const byOrder = (a: Task, b: Task) => a.kanbanOrder - b.kanbanOrder;
  const byDue = (a: Task, b: Task) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || byOrder(a, b);
  byView.today.sort(byOrder);
  byView.inbox.sort(byOrder);
  byView.upcoming.sort(byDue);
  byView.overdue.sort(byDue);
  byView.completed.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const showToast = (msg: string, undo?: () => void) => setToast({ msg, undo });

  const quickAdd = () => {
    const parsed = parseQuickAdd(draft, today);
    if (!parsed.title) return;
    taskApi.add({
      title: parsed.title,
      priority: parsed.priority ?? "medium",
      tags: parsed.tags,
      dueDate: parsed.dueDate,
    });
    setDraft("");
    inputRef.current?.focus();
  };

  // Real toggle: complete is idempotent and stores completedAt (undo also
  // removes the spawned next instance of a recurring series).
  const toggleDone = (task: Task) => {
    if (task.status === "done") {
      taskApi.reopen(task.id);
      return;
    }
    const next = taskApi.complete(task.id);
    showToast(t.tasks.toasts.completed, () => {
      taskApi.reopen(task.id);
      if (next) taskApi.remove(next.id);
    });
  };

  const removeTask = (task: Task) => {
    if (task.recurrence) {
      setSeriesTask(task);
      return;
    }
    taskApi.remove(task.id);
    showToast(t.tasks.toasts.deleted, () => taskApi.restore(task.id));
  };

  const removeInstance = () => {
    const task = seriesTask;
    if (!task) return;
    setSeriesTask(null);
    taskApi.remove(task.id);
    showToast(t.tasks.toasts.deleted, () => taskApi.restore(task.id));
  };

  const removeSeries = (task: Task) => {
    const ids = seriesIds(task, live);
    for (const id of ids) taskApi.remove(id);
    setSeriesTask(null);
    showToast(t.tasks.toasts.seriesDeleted, () => {
      for (const id of ids) taskApi.restore(id);
    });
  };

  const visible = byView[view];
  const hasFilters = search !== "" || priorityFilter !== "all" || tagFilter !== "all";

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.tasks}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.pages.tasks.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.pages.tasks.body}</p>

      <form
        className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card p-2"
        onSubmit={(e) => {
          e.preventDefault();
          quickAdd();
        }}
      >
        <Plus className="ms-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.tasks.quickAddPlaceholder}
          aria-label={t.tasks.add}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={!draft.trim()} className={PRIMARY_BTN + " px-3 py-1.5"}>
          {t.tasks.add}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented m-0 max-w-full overflow-x-auto" role="radiogroup" aria-label={t.nav.tasks}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => {
                setView(v);
                setExpandedId(null);
              }}
              className="segment whitespace-nowrap"
            >
              {t.tasks.view[v]}
              <span className="ms-1 text-xs font-normal text-muted-foreground">{formatNumber(locale, byView[v].length)}</span>
            </button>
          ))}
        </div>
        <div className="segmented m-0" role="radiogroup" aria-label={t.tasks.display}>
          <button type="button" role="radio" aria-checked={mode === "list"} onClick={() => setMode("list")} className="segment">
            <List className="size-4" aria-hidden />
            {t.tasks.mode.list}
          </button>
          <button type="button" role="radio" aria-checked={mode === "board"} onClick={() => setMode("board")} className="segment">
            <KanbanSquare className="size-4" aria-hidden />
            {t.tasks.mode.board}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-44 flex-1 items-center gap-2 rounded-md border border-border bg-card px-2">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.tasks.search}
            aria-label={t.tasks.search}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value === "all" ? "all" : (e.target.value as Priority))}
          aria-label={t.tasks.filterPriority}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"
        >
          <option value="all">{t.tasks.filterPriority + ": " + t.tasks.all}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t.tasks.priority[p]}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label={t.tasks.filterTag}
          disabled={allTags.length === 0}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"
        >
          <option value="all">{t.tasks.filterTag + ": " + t.tasks.all}</option>
          {allTags.map((g) => (
            <option key={g} value={g}>
              {"#" + g}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPriorityFilter("all");
              setTagFilter("all");
            }}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            {t.tasks.clearFilters}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState view={view} onAdd={() => inputRef.current?.focus()} />
      ) : mode === "list" ? (
        <ul className="mt-4 space-y-2">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              expanded={expandedId === task.id}
              onToggle={() => toggleDone(task)}
              onExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
              onDelete={() => removeTask(task)}
            />
          ))}
        </ul>
      ) : (
        <BoardSection
          list={visible}
          today={today}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onToggle={toggleDone}
          onDelete={removeTask}
          showToast={showToast}
        />
      )}

      {seriesTask && (
        <Modal title={t.tasks.seriesTitle} onClose={() => setSeriesTask(null)}>
          <h2 className="font-display text-lg font-semibold">{t.tasks.seriesTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.tasks.seriesBody}</p>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setSeriesTask(null)} className={OUTLINE_BTN}>
              {t.tasks.cancel}
            </button>
            <button type="button" onClick={removeInstance} className={OUTLINE_BTN}>
              {t.tasks.seriesInstance}
            </button>
            <button type="button" onClick={() => removeSeries(seriesTask)} className={DANGER_BTN}>
              {t.tasks.seriesAll}
            </button>
          </div>
        </Modal>
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
              {t.tasks.toasts.undo}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- skeleton / empty ---------------- */

function TasksSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-16 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-56 animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-12 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-accent/30" />
      <div className="mt-6 space-y-2">
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
        <div className="h-16 animate-pulse rounded-xl bg-accent/30" />
      </div>
    </section>
  );
}

function EmptyState({ view, onAdd }: { view: ViewKey; onAdd: () => void }) {
  const { t } = usePrefs();
  const e = t.tasks.empty[view];
  return (
    <div className="empty-card mt-4">
      <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <ListChecks className="size-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{e.title}</p>
      <p className="text-sm text-muted-foreground">{e.body}</p>
      <button type="button" onClick={onAdd} className={PRIMARY_BTN}>
        {t.tasks.empty.action}
      </button>
    </div>
  );
}

/* ---------------- list mode ---------------- */

function TaskRow({
  task,
  today,
  expanded,
  onToggle,
  onExpand,
  onDelete,
}: {
  task: Task;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = usePrefs();
  const done = task.status === "done";
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className="panel overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <CheckButton checked={done} onToggle={onToggle} label={done ? t.tasks.reopen : t.tasks.markDone} />
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="min-w-0 flex-1 text-start">
          <span className={"text-sm font-medium " + (done ? "text-muted-foreground line-through" : "")}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.priority !== "medium" && (
              <span className="inline-flex items-center gap-1">
                <span className={"size-2 rounded-full " + PRIO_CLS[task.priority]} aria-hidden />
                {t.tasks.priority[task.priority]}
              </span>
            )}
            {task.dueDate && (
              <span className={"inline-flex items-center gap-1 " + dueChipCls(task, today)}>
                <Calendar className="size-3" aria-hidden />
                {formatDate(locale, new Date(task.dueDate + "T12:00:00Z"), { dateStyle: "medium" })}
              </span>
            )}
            {task.recurrence && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" aria-hidden />
                {t.tasks.repeat[task.recurrence.freq]}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="tabular-nums">
                {formatNumber(locale, subDone) + "/" + formatNumber(locale, task.subtasks.length)}
              </span>
            )}
            {task.tags.map((g) => (
              <span key={g} className="rounded bg-accent/40 px-1.5 py-0.5">
                {"#" + g}
              </span>
            ))}
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.tasks.delete}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {expanded && <TaskEditor task={task} today={today} onCollapse={onExpand} />}
    </li>
  );
}

/* ---------------- board mode ---------------- */

function BoardSection({
  list,
  today,
  expandedId,
  setExpandedId,
  onToggle,
  onDelete,
  showToast,
}: {
  list: Task[];
  today: string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  showToast: (msg: string, undo?: () => void) => void;
}) {
  const { t, locale } = usePrefs();
  const [dragId, setDragId] = useState<string | null>(null);

  const cols: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
  for (const x of list) cols[x.status].push(x);
  for (const st of STS) cols[st].sort((a, b) => a.kanbanOrder - b.kanbanOrder);

  const complete = (task: Task) => {
    const next = taskApi.complete(task.id);
    showToast(t.tasks.toasts.completed, () => {
      taskApi.reopen(task.id);
      if (next) taskApi.remove(next.id);
    });
  };

  const setStatus = (task: Task, to: TaskStatus) => {
    if (task.status === to) return;
    if (to === "done") complete(task);
    else if (task.status === "done") {
      taskApi.reopen(task.id);
      taskApi.update(task.id, { status: to });
    } else taskApi.update(task.id, { status: to });
  };

  // Keyboard alternative to drag & drop: move to the previous/next column.
  const moveBy = (task: Task, dir: -1 | 1) => {
    const i = STS.indexOf(task.status);
    const j = i + dir;
    if (j < 0 || j >= STS.length) return;
    const to = STS[j];
    if (to) setStatus(task, to);
  };

  const drop = (to: TaskStatus, beforeId: string | null) => {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const task = list.find((x) => x.id === id);
    if (!task || id === beforeId) return;
    setStatus(task, to);
    // Persist the new order of the target column (drop on a card inserts there).
    const target = cols[to].filter((x) => x.id !== id).map((x) => x.id);
    const at = beforeId ? target.indexOf(beforeId) : target.length;
    if (at < 0) target.push(id);
    else target.splice(at, 0, id);
    taskApi.reorder(target);
  };

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {STS.map((st) => (
        <section
          key={st}
          aria-label={t.tasks.column[st]}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            drop(st, null);
          }}
          className="min-h-40 rounded-xl border border-border bg-sidebar/40 p-2"
        >
          <header className="flex items-center justify-between px-1 py-1.5">
            <span className="text-sm font-semibold">{t.tasks.column[st]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(locale, cols[st].length)}</span>
          </header>
          <ul className="space-y-2">
            {cols[st].map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                today={today}
                dragging={dragId === task.id}
                canPrev={st !== "todo"}
                canNext={st !== "done"}
                onDragStart={() => setDragId(task.id)}
                onDragEnd={() => setDragId(null)}
                onDropHere={() => drop(st, task.id)}
                onToggle={() => onToggle(task)}
                onDelete={() => onDelete(task)}
                onMove={(dir) => moveBy(task, dir)}
                expanded={expandedId === task.id}
                onExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
              />
            ))}
            {cols[st].length === 0 && (
              <li className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                —
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BoardCard({
  task,
  today,
  dragging,
  canPrev,
  canNext,
  onDragStart,
  onDragEnd,
  onDropHere,
  onToggle,
  onDelete,
  onMove,
  expanded,
  onExpand,
}: {
  task: Task;
  today: string;
  dragging: boolean;
  canPrev: boolean;
  canNext: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropHere: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const { t, locale } = usePrefs();
  const done = task.status === "done";
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropHere();
      }}
      className={"panel p-2.5 " + (dragging ? "opacity-40" : "")}
    >
      <div className="flex items-start gap-2">
        <CheckButton checked={done} onToggle={onToggle} label={done ? t.tasks.reopen : t.tasks.markDone} />
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="min-w-0 flex-1 text-start">
          <span className={"text-sm font-medium " + (done ? "text-muted-foreground line-through" : "")}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {task.priority !== "medium" && <span className={"size-2 rounded-full " + PRIO_CLS[task.priority]} aria-hidden />}
            {task.dueDate && (
              <span className={"inline-flex items-center gap-1 " + dueChipCls(task, today)}>
                <Calendar className="size-3" aria-hidden />
                {formatDate(locale, new Date(task.dueDate + "T12:00:00Z"), { dateStyle: "medium" })}
              </span>
            )}
            {task.recurrence && <Repeat className="size-3" aria-hidden />}
            {task.subtasks.length > 0 && (
              <span className="tabular-nums">
                {formatNumber(locale, task.subtasks.filter((s) => s.done).length) +
                  "/" +
                  formatNumber(locale, task.subtasks.length)}
              </span>
            )}
            {task.tags.map((g) => (
              <span key={g} className="rounded bg-accent/40 px-1 py-0.5">
                {"#" + g}
              </span>
            ))}
          </span>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canPrev}
            aria-label={t.tasks.movePrev}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30"
          >
            <ChevronLeft className="size-4 rtl-flip" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canNext}
            aria-label={t.tasks.moveNext}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30"
          >
            <ChevronRight className="size-4 rtl-flip" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.tasks.delete}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {expanded && <TaskEditor task={task} today={today} onCollapse={onExpand} />}
    </li>
  );
}

/* ---------------- editor (all fields) ---------------- */

function TaskEditor({ task, today, onCollapse }: { task: Task; today: string; onCollapse: () => void }) {
  const { t, locale } = usePrefs();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [due, setDue] = useState(task.dueDate ?? "");
  const [prio, setPrio] = useState<Priority>(task.priority);
  const [tagsText, setTagsText] = useState(task.tags.join(" "));
  const [freq, setFreq] = useState<"none" | RecurrenceRule["freq"]>(task.recurrence ? task.recurrence.freq : "none");
  const [days, setDays] = useState<number[]>(task.recurrence?.byWeekday ?? [weekdayOf(due !== "" ? due : today)]);
  const [subDraft, setSubDraft] = useState("");

  const save = () => {
    let rule: RecurrenceRule | undefined;
    if (freq === "daily") rule = { freq: "daily", interval: 1 };
    else if (freq === "monthly") rule = { freq: "monthly", interval: 1 };
    else if (freq === "weekly")
      rule = { freq: "weekly", interval: 1, byWeekday: days.length > 0 ? [...days].sort((a, b) => a - b) : undefined };
    const tags = tagsText
      .split(/[\s,]+/)
      .map((x) => x.replace(/^#/, "").toLowerCase())
      .filter((x) => x !== "");
    taskApi.update(task.id, {
      title: title.trim() !== "" ? title.trim() : task.title,
      notes: notes.trim() !== "" ? notes : undefined,
      dueDate: due !== "" ? due : undefined,
      priority: prio,
      tags,
      recurrence: rule,
    });
    onCollapse();
  };

  const subAdd = (text: string) => {
    const v = text.trim();
    if (v === "") return;
    taskApi.update(task.id, { subtasks: [...task.subtasks, { id: crypto.randomUUID(), title: v, done: false }] });
    setSubDraft("");
  };
  const subToggle = (id: string) =>
    taskApi.update(task.id, { subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  const subRemove = (id: string) => taskApi.update(task.id, { subtasks: task.subtasks.filter((s) => s.id !== id) });
  const subMove = (id: string, dir: -1 | 1) => {
    const list = [...task.subtasks];
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i];
    const b = list[j];
    if (!a || !b) return;
    list[i] = b;
    list[j] = a;
    taskApi.update(task.id, { subtasks: list });
  };

  return (
    <div className="border-t border-border/60 p-3">
      <div className="grid gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={t.tasks.titleLabel}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium text-muted-foreground">{t.tasks.due}</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t.tasks.filterPriority}</span>
            <Segmented
              label={t.tasks.filterPriority}
              value={prio}
              onChange={(v) => setPrio(v as Priority)}
              options={PRIORITIES.map((p) => ({ value: p, label: t.tasks.priority[p] }))}
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{t.tasks.repeats}</span>
          <Segmented
            label={t.tasks.repeats}
            value={freq}
            onChange={(v) => setFreq(v as "none" | RecurrenceRule["freq"])}
            options={[
              { value: "none", label: t.tasks.repeat.none },
              { value: "daily", label: t.tasks.repeat.daily },
              { value: "weekly", label: t.tasks.repeat.weekly },
              { value: "monthly", label: t.tasks.repeat.monthly },
            ]}
          />
          {freq === "weekly" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                  className={
                    "rounded-md border px-2 py-1 text-xs transition-colors " +
                    (days.includes(d)
                      ? "border-primary bg-accent/40 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/20")
                  }
                >
                  {weekdayShort(locale, d)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{t.tasks.notes}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.tasks.notesPlaceholder}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{t.tasks.filterTag}</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder={t.tasks.tagsPlaceholder}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{t.tasks.subtasks}</span>
          <ul className="mt-2 space-y-1">
            {task.subtasks.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/20">
                <CheckButton checked={s.done} onToggle={() => subToggle(s.id)} label={s.title} />
                <span className={"min-w-0 flex-1 text-sm " + (s.done ? "text-muted-foreground line-through" : "")}>
                  {s.title}
                </span>
                <button
                  type="button"
                  onClick={() => subMove(s.id, -1)}
                  disabled={i === 0}
                  aria-label={t.tasks.moveUp}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => subMove(s.id, 1)}
                  disabled={i === task.subtasks.length - 1}
                  aria-label={t.tasks.moveDown}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => subRemove(s.id)}
                  aria-label={t.tasks.delete}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  subAdd(subDraft);
                }
              }}
              placeholder={t.tasks.addSubtask}
              aria-label={t.tasks.addSubtask}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => subAdd(subDraft)}
              aria-label={t.tasks.add}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCollapse} className={OUTLINE_BTN}>
            {t.tasks.cancel}
          </button>
          <button type="button" onClick={save} className={PRIMARY_BTN}>
            {t.tasks.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function CheckButton({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={
        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors " +
        (checked ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:border-primary")
      }
    >
      <Check className="size-3" aria-hidden />
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="segmented m-0" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="segment"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-overlay px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- pure helpers ---------------- */

function dueChipCls(task: Task, today: string): string {
  if (task.status === "done") return "text-muted-foreground";
  if (!task.dueDate) return "text-muted-foreground";
  if (task.dueDate < today) return "text-destructive";
  if (task.dueDate === today) return "text-primary";
  return "text-muted-foreground";
}

/** Same series: shared seriesId, else same title + same rule (legacy rows). */
function seriesIds(task: Task, live: Task[]): string[] {
  return live
    .filter((x) => x.recurrence !== undefined)
    .filter((x) =>
      task.seriesId !== undefined
        ? x.seriesId === task.seriesId
        : x.title === task.title && sameRule(x.recurrence!, task.recurrence!),
    )
    .map((x) => x.id);
}

function sameRule(a: RecurrenceRule, b: RecurrenceRule): boolean {
  return a.freq === b.freq && a.interval === b.interval && (a.byWeekday ?? []).join(",") === (b.byWeekday ?? []).join(",");
}

function weekdayShort(locale: Locale, d: number): string {
  // 2023-01-01 was a Sunday, so the 1st + d lands on that weekday.
  const day = new Date(Date.UTC(2023, 0, 1 + d));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(day);
}
