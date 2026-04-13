import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ScrollText, Search, LogIn, ClipboardCheck, UserPlus,
  BrainCircuit, Pencil, Trash2, Users, ChevronDown,
} from "lucide-react";
import { logsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input }  from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// ── Action config — Lucide icons, no emoji ────────────────────────────────────
const ACTION_CONFIG = {
  login:                    { icon: LogIn,          color: "text-blue-400",    bg: "bg-blue-500/10"    },
  attendance_marked:        { icon: ClipboardCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  bulk_attendance_marked:   { icon: Users,          color: "text-teal-400",    bg: "bg-teal-500/10"    },
  user_created:             { icon: UserPlus,       color: "text-violet-400",  bg: "bg-violet-500/10"  },
  user_updated:             { icon: Pencil,         color: "text-amber-400",   bg: "bg-amber-500/10"   },
  user_deleted:             { icon: Trash2,         color: "text-red-400",     bg: "bg-red-500/10"     },
  insight_generated:        { icon: BrainCircuit,   color: "text-amber-400",   bg: "bg-amber-500/10"   },
};

const DEFAULT_CONFIG = { icon: ScrollText, color: "text-white/50", bg: "bg-white/[0.04]" };
const ALL_ACTIONS    = Object.keys(ACTION_CONFIG);
const PAGE_SIZE      = 50;

function ActionIcon({ action }) {
  const cfg  = ACTION_CONFIG[action] || DEFAULT_CONFIG;
  const Icon = cfg.icon;
  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
    </div>
  );
}

export default function Logs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page,    setPage]    = useState(0);
  const [search,  setSearch]  = useState("");
  const [action,  setAction]  = useState("");
  const searchDebounce = useRef(null);

  // ── Fetch with pagination ─────────────────────────────────────────────────
  const fetchLogs = useCallback(async (pageNum = 0, replace = true) => {
    setLoading(true);
    try {
      const params = {
        limit:  PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      };
      if (action) params.action = action;
      if (search) params.search = search;
      const { data } = await logsApi.list(params);

      const rows = Array.isArray(data) ? data : (data.logs ?? []);
      setLogs(prev => replace ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageNum);
    } catch { /* interceptor handles 401 */ }
    finally  { setLoading(false); }
  }, [action, search]);

  // Refetch when action filter changes
  useEffect(() => { fetchLogs(0, true); }, [fetchLogs]);

  const loadMore = () => fetchLogs(page + 1, false);

  // ── Server-side search results (no client filtering) ─────────────────────────
  const filtered = logs;

  // ── Detail formatter ───────────────────────────────────────────────────────
  function fmtDetails(details) {
    if (!details) return "—";
    const entries = Object.entries(details).slice(0, 3);
    return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <ScrollText className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          Activity Logs
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${filtered.length} entries shown`}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search user or action…"
                className="pl-9"
                value={search}
                onChange={e => {
                  const val = e.target.value;
                  setSearch(val);
                  clearTimeout(searchDebounce.current);
                  searchDebounce.current = setTimeout(() => {
                    fetchLogs(0, true);
                  }, 400);
                }}
              />
            </div>
            <Select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-52"
            >
              <option value="">All actions</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Action", "User", "Details", "IP", "Time"].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[1, 2, 3, 4, 5].map(j => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-white/[0.05] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-white/30">
                        No logs found
                      </td>
                    </tr>
                  )
                  : filtered.map((log, i) => {
                    const cfg = ACTION_CONFIG[log.action] || DEFAULT_CONFIG;
                    return (
                      <motion.tr
                        key={log.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      >
                        {/* Action */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <ActionIcon action={log.action} />
                            <span className={`font-medium capitalize text-xs ${cfg.color}`}>
                              {log.action.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-5 py-3.5 text-white/70 text-sm">
                          {log.user_name || "—"}
                        </td>

                        {/* Details */}
                        <td className="px-5 py-3.5 text-white/40 text-xs font-mono max-w-[220px] truncate">
                          {fmtDetails(log.details)}
                        </td>

                        {/* IP */}
                        <td className="px-5 py-3.5 text-white/30 text-xs font-mono">
                          {log.ip_address || "—"}
                        </td>

                        {/* Time */}
                        <td className="px-5 py-3.5 text-white/40 text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, h:mm a")}
                        </td>
                      </motion.tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center py-4 border-t border-white/[0.04]">
            <Button variant="outline" size="sm" onClick={loadMore}>
              <ChevronDown className="w-3.5 h-3.5" />
              Load more
            </Button>
          </div>
        )}

        {/* Loading more indicator */}
        {loading && logs.length > 0 && (
          <div className="flex justify-center py-4 border-t border-white/[0.04]">
            <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}