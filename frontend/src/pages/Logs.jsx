import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ScrollText, Search, Filter } from "lucide-react";
import { logsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { format } from "date-fns";

const ACTION_ICONS = {
  login:                "🔐",
  attendance_marked:    "✅",
  user_created:         "👤",
  insight_generated:    "🤖",
};

const ACTION_COLORS = {
  login:                "text-blue-400",
  attendance_marked:    "text-emerald-400",
  user_created:         "text-violet-400",
  insight_generated:    "text-amber-400",
};

const ACTIONS = ["login", "attendance_marked", "user_created", "insight_generated"];

export default function Logs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [action, setAction]   = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = { limit: 200 };
      if (action) p.action = action;
      const { data } = await logsApi.list(p);
      setLogs(data);
    } finally { setLoading(false); }
  }, [action]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l =>
    l.user_name.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-white/40" />
          Activity Logs
        </h2>
        <p className="text-sm text-white/40">{filtered.length} entries</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input placeholder="Search user or action…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={action} onChange={e => setAction(e.target.value)} className="w-48">
              <option value="">All actions</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Action","User","Details","IP","Time"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[1,2,3,4,5].map(j => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-white/[0.05] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : filtered.length === 0
                  ? <tr><td colSpan={5} className="text-center py-12 text-white/30">No logs found</td></tr>
                  : filtered.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span>{ACTION_ICONS[log.action] || "📋"}</span>
                          <span className={`font-medium capitalize ${ACTION_COLORS[log.action] || "text-white/70"}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-white/70">{log.user_name}</td>
                      <td className="px-5 py-3.5 text-white/40 text-xs font-mono max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details).slice(0, 60) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-white/30 text-xs font-mono">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
