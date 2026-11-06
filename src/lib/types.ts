/** Schema entity types. Bump CURRENT_SCHEMA_VERSION + add a migration when changing. */
export const CURRENT_SCHEMA_VERSION = 4;

export type ISODate = string; // full ISO timestamp
export type LocalDay = string; // 'YYYY-MM-DD', stored at creation, never recomputed

export interface BaseRecord {
  id: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate | undefined;
}

export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "doing" | "done";

export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  interval: number; // every N units, >= 1
  byWeekday?: number[] | undefined; // 0=Sun..6=Sat, weekly only
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  notes?: string | undefined;
  priority: Priority;
  dueDate?: LocalDay | undefined;
  tags: string[];
  subtasks: Subtask[];
  status: TaskStatus;
  completedAt?: ISODate | undefined;
  recurrence?: RecurrenceRule | undefined;
  /** Identifies one recurring series; generated instances inherit it (additive optional field). */
  seriesId?: string | undefined;
  kanbanOrder: number;
}

export interface HabitSchedule {
  type: "daily" | "weekly" | "custom";
  days: number[]; // 0=Sun..6=Sat
}

export interface Habit extends BaseRecord {
  name: string;
  schedule: HabitSchedule;
  archived: boolean;
}

export interface HabitLog extends BaseRecord {
  habitId: string;
  localDay: LocalDay;
  status: "done" | "skipped";
}

export interface FocusSession extends BaseRecord {
  mode: "pomodoro" | "custom" | "break";
  plannedMinutes: number;
  startedAt: ISODate;
  endsAt: ISODate;
  endedAt?: ISODate | undefined;
  /** Set while the countdown is frozen; cleared when endsAt is shifted on resume. */
  pausedAt?: ISODate | undefined;
  completed: boolean;
  distractions: { at: ISODate }[];
  linkedTaskId?: string | undefined;
  localDay: LocalDay;
}

export interface Xp
LedgerEntry extends BaseRecord {
  sourceType: "task" | "habit" | "focus" | "challenge" | "achievement" | "shop";
  sourceId: string;
  localDay: LocalDay;
  xp: number;
  coins: number;
}

/** An achievement unlocked once; written by the store after reward checks. */
export interface AchievementUnlock extends BaseRecord {
  achievementId: string;
  unlockedAt: ISODate;
  localDay: LocalDay;
}

/** Unlockable accent themes — hue sets live in src/styles.css, unlock rules in rewardsConfig. */
export const ACCENT_IDS = ["moss", "sage", "pine", "clay", "dusk"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

/** A user-defined reward the user can buy with coins. */
export interface ShopItem extends BaseRecord {
  name: string;
  note?: string | undefined;
  /** Coin price — a positive integer. */
  price: number;
}

/**
 * One purchase. The matching xpLedger entry (sourceType "shop",
 * sourceId = id, coins = -price, xp 0) carries the spent coins; this
 * record keeps the history and the used/refunded state. name and price
 * are snapshots at buy time, so deleting the item never rewrites
 * history. Soft-delete marks a refund (same localDay, unused only).
 */
export interface Purchase extends BaseRecord {
  itemId: string;
  name: string;
  price: number;
  localDay: LocalDay;
  /** Set when the user redeems the purchase themselves. */
  usedAt?: ISODate | undefined;
}

/** A free-form Markdown note — thoughts, plans and links. Notes sit outside the XP economy. */
export interface Note extends BaseRecord {
  title: string;
  body: string;
  /** Optional link to a task this note belongs to. */
  linkedTaskId?: string | undefined;
  pinned?: boolean | undefined;
}

export type DashboardCard = "priorities" | "progress" | "deadlines" | "habits" | "focus" | "level" | "achievements";

/**
 * Quiet daily digest preferences. Off by default — silence is the default;
 * only the user opts in. Additive optional field: no schemaVersion bump.
 */
export interface DigestPrefs {
  enabled: boolean;
  /** Local clock times ("HH:MM") for the morning and evening summaries. */
  morningAt: string;
  eveningAt: string;
}

export interface Settings {
  language: "en" | "ar";
  theme: "light" | "dark" | "system";
  accent: AccentId;
  dayStartHour: 0 | 4;
  weekStartsOn: number; // 0=Sun..6=Sat
  dash
boardCards: Record<DashboardCard, boolean>;
  dailyFocusTargetMinutes: number;
  digest?: DigestPrefs | undefined;
  updatedAt: ISODate;
}

export interface Meta {
  schemaVersion: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** ISO timestamp of the last export; drives the 7-day backup reminder. */
  lastExportedAt?: ISODate | undefined;
}

export interface Collections {
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  achievements: AchievementUnlock[];
  shopItems: ShopItem[];
  purchases: Purchase[];
}
export type CollectionKey = keyof Collections;
export const COLLECTION_KEYS: CollectionKey[] = [
  "tasks",
  "notes",
  "habits",
  "habitLogs",
  "focusSessions",
  "xpLedger",
  "achievements",
  "shopItems",
  "purchases",
];

/** Full snapshot = every storage key. Used for load, export, import and migrations. */
export interface Snapshot extends Collections {
  settings: Settings;
  meta: Meta;
}
export type StorageKey = keyof Snapshot;
export const STORAGE_KEYS: StorageKey[] = [...COLLECTION_KEYS, "settings", "meta"];
