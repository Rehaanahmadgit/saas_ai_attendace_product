/**
 * utils.js — shared helpers used across the app
 * Import from here instead of duplicating in every component
 */
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Tailwind class merger (used by shadcn/ui components) ──────────────────────
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ── Name → initials (max 2 chars) ─────────────────────────────────────────────
export function getInitials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase() || "?";
}

// ── Role hierarchy level ───────────────────────────────────────────────────────
const ROLE_LEVEL = { super_admin: 4, admin: 3, staff: 2, user: 1 };

export function getRoleLevel(role) {
  return ROLE_LEVEL[role] || 0;
}

export function hasMinRole(userRole, minRole) {
  return getRoleLevel(userRole) >= getRoleLevel(minRole);
}

// ── Attendance rate colour ────────────────────────────────────────────────────
export function rateColor(rate) {
  if (rate >= 85) return "text-emerald-400";
  if (rate >= 70) return "text-amber-400";
  return "text-red-400";
}

export function rateBg(rate) {
  if (rate >= 85) return "#10B981";
  if (rate >= 70) return "#F59E0B";
  return "#EF4444";
}

// ── Truncate long strings ─────────────────────────────────────────────────────
export function truncate(str = "", max = 40) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// ── Format duration in hours → "2h 30m" ──────────────────────────────────────
export function fmtDuration(hours) {
  if (!hours) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Pluralise ─────────────────────────────────────────────────────────────────
export function plural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : (plural ?? singular + "s")}`;
}