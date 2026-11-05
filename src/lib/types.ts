/** Schema v1 entity types. Bump CURRENT_SCHEMA_VERSION + add a migration when changing. */
export const CURRENT_SCHEMA_VERSION = 1;

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
  completed: boolean;
  distractions: { at: ISODate }[];
  linkedTaskId?: string | undefined;
  localDay: LocalDay;
}

export interface XpLedgerEntry extends BaseRecord {
  sourceType: "task" | "habit" | "focus" | "challenge" | "achievement" | "shop";
  sourceId: string;
  localDay: LocalDay;
  xp: number;
  coins: number;
}

export type DashboardCard = "priorities" | "progress" | "deadlines" | "habits" | "focus" | "level" | "achievements";

export interface Settings {
  language: "en" | "ar";
  theme: "light" | "dark" | "system";
  accent: string;
  dayStartHour: 0 | 4;
  weekStartsOn: number; // 0=Sun..6=Sat
  dashboardCards: Record<DashboardCard, boolean>;
  dailyFocusTargetMinutes: number;
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
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
}
export type CollectionKey = keyof Collections;
export const COLLECTION_KEYS: CollectionKey[] = ["tasks", "habits", "habitLogs", "focusSessions", "xpLedger"];

/** Full snapshot = every storage key. Used for load, export, import and migrations. */
export interface Snapshot extends Collections {
  settings: Settings;
  meta: Meta;
}
export type StorageKey = keyof Snapshot;
export const STORAGE_KEYS: StorageKey[] = [...COLLECTION_KEYS, "settings", "meta"];
