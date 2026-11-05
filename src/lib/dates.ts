import type { LocalDay } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function wallClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") };
}

/** Wall-clock day in `timeZone`; hours before `dayStartHour` belong to the previous day. */
export function toLocalDay(date: Date, dayStartHour = 0, timeZone = currentTimeZone()): LocalDay {
  const { y, m, d, h } = wallClock(date, timeZone);
  const day = `${y}-${pad(m)}-${pad(d)}`;
  return h < dayStartHour ? addDays(day, -1) : day;
}

export function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// LocalDay arithmetic is done on UTC dates so DST never shifts a calendar day.
function parse(day: LocalDay) {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function format(dt: Date): LocalDay {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(day: LocalDay, n: number): LocalDay {
  const dt = parse(day);
  dt.setUTCDate(dt.getUTCDate() + n);
  return format(dt);
}

export function addMonths(day: LocalDay, n: number): LocalDay {
  const dt = parse(day);
  const target = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + n);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(target, last));
  return format(dt);
}

/** 0=Sun..6=Sat */
export function weekdayOf(day: LocalDay): number {
  return parse(day).getUTCDay();
}

export function startOfWeek(day: LocalDay, weekStartsOn: number): LocalDay {
  const diff = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function endOfWeek(day: LocalDay, weekStartsOn: number): LocalDay {
  return addDays(startOfWeek(day, weekStartsOn), 6);
}

export function startOfMonth(day: LocalDay): LocalDay {
  return day.slice(0, 8) + "01";
}

export function endOfMonth(day: LocalDay): LocalDay {
  const dt = parse(day);
  return format(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)));
}

export function daysBetween(a: LocalDay, b: LocalDay): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Default week start: Saturday for Arabic, Monday for English. */
export function defaultWeekStartsOn(language: "en" | "ar"): number {
  return language === "ar" ? 6 : 1;
}
