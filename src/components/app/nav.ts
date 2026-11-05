import { BarChart3, CheckSquare, Gift, LayoutDashboard, Repeat, Settings, Timer, type LucideIcon } from "lucide-react";

export type NavKey = "dashboard" | "tasks" | "habits" | "focus" | "rewards" | "insights" | "settings";
export type NavItem = { key: NavKey; to: "/" | "/tasks" | "/habits" | "/focus" | "/rewards" | "/insights" | "/settings"; icon: LucideIcon };

export const NAV: NavItem[] = [
  { key: "dashboard", to: "/", icon: LayoutDashboard },
  { key: "tasks", to: "/tasks", icon: CheckSquare },
  { key: "habits", to: "/habits", icon: Repeat },
  { key: "focus", to: "/focus", icon: Timer },
  { key: "rewards", to: "/rewards", icon: Gift },
  { key: "insights", to: "/insights", icon: BarChart3 },
  { key: "settings", to: "/settings", icon: Settings },
];
