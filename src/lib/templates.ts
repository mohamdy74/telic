import type { Settings } from "./types";

export type TemplateId = "study" | "freelance" | "content" | "ramadan";
export type TemplateLocale = Settings["language"];

export interface NoteTemplate {
  id: TemplateId;
  title: Record<TemplateLocale, string>;
  body: Record<TemplateLocale, string>;
}

/** RED stub — templates.test.ts drives the real implementation. */
export const NOTE_TEMPLATES: NoteTemplate[] = [];

/** RED stub — returns the template copy for the asked locale, null for unknown ids. */
export function templateFor(_id: string, _locale: TemplateLocale): { title: string; body: string } | null {
  return null;
}
