import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, RefreshCw, Loader2, Cpu, ExternalLink, CheckCircle2 } from "lucide-react";
import { insightsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import InsightCard from "@/components/shared/InsightCard";
import { format } from "date-fns";

const MCP_ENDPOINTS = [
  { method: "GET",  path: "/api/insights",          description: "Fetch all AI insights with MCP context" },
  { method: "POST", path: "/api/insights/generate", description: "Trigger fresh insight computation" },
  { method: "GET",  path: "/api/insights/summary",  description: "Natural-language summary for AI agents" },
  { method: "GET",  path: "/api/analytics/trends",  description: "Attendance trend data for AI analysis" },
  { method: "GET",  path: "/api/analytics/user-performance", description: "Per-user stats for AI queries" },
];

export default function Insights() {
  const [data, setData]         = useState(null);
  const [nlSummary, setNlSummary] = useState(null); // natural-language summary from /api/insights/summary
  const [loading, setLoading]   = useState(true);
  const [generating, setGen]    = useState(false);
  const [genMsg, setGenMsg]     = useState("");

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const [{ data: d }, { data: s }] = await Promise.all([
        insightsApi.list(),
        insightsApi.summary(),
      ]);
      setData(d);
      setNlSummary(s);
    } catch { /* handled */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInsights(); }, []);

  const handleGenerate = async () => {
    setGen(true); setGenMsg("");
    try {
      const { data: r } = await insightsApi.generate();
      setGenMsg(`${r.generated} insights generated successfully`);
      fetchInsights();
      setTimeout(() => setGenMsg(""), 5000);
    } catch (err) {
      setGenMsg("Generation failed — check backend connection");
    } finally {
      setGen(false);
    }
  };

  const handleMarkRead = async (id) => {
    await insightsApi.markRead(id);
    setData(prev => ({
      ...prev,
      insights: prev.insights.map(i => i.id === id ? { ...i, is_read: true } : i),
      unread: Math.max(0, prev.unread - 1),
    }));
  };

  const unread   = data?.insights?.filter(i => !i.is_read) || [];
  const read     = data?.insights?.filter(i => i.is_read)  || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-violet-400" />
            AI Insights
          </h2>
          <p className="text-sm text-white/40 mt-1">
            {data ? `${data.total} insights · ${data.unread} unread` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {genMsg && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-sm text-emerald-400"
            >
              <CheckCircle2 className="w-4 h-4" />{genMsg}
            </motion.span>
          )}
          <Button variant="gradient" onClick={handleGenerate} disabled={generating}>
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</>
              : <><RefreshCw className="w-4 h-4" />Generate Insights</>
            }
          </Button>
        </div>
      </div>

      {/* Summary banner */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 border-l-2 border-violet-500"
        >
          <p className="text-sm text-white/70">{data.summary}</p>
        </motion.div>
      )}

      {/* Unread insights */}
      {!loading && unread.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
            Requires Attention ({unread.length})
          </h3>
          <div className="space-y-3">
            {unread.map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} onMarkRead={handleMarkRead} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Read insights */}
      {!loading && read.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/30 uppercase tracking-wider mb-3">
            Reviewed ({read.length})
          </h3>
          <div className="space-y-3 opacity-60">
            {read.map((ins, i) => (
              <InsightCard key={ins.id} insight={ins} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !data?.insights?.length && (
        <Card>
          <CardContent className="py-16 text-center">
            <BrainCircuit className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-sm">No insights yet.</p>
            <p className="text-white/25 text-xs mt-1">Click &quot;Generate Insights&quot; to analyze your attendance data.</p>
          </CardContent>
        </Card>
      )}

      {/* MCP-ready API section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            MCP-Ready Endpoints
            <span className="ml-auto text-xs font-normal text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              AI Agent Ready
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-white/40 mb-4">
            These endpoints are structured for AI agent / MCP tool consumption.
            Future integration: connect an MCP server to query attendance data with natural language.
          </p>
          <div className="space-y-2">
            {MCP_ENDPOINTS.map(ep => (
              <div key={ep.path} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <span className={`text-[10px] font-bold px-2 py-1 rounded font-mono flex-shrink-0 ${
                  ep.method === "GET"  ? "bg-blue-500/10  text-blue-400" :
                  ep.method === "POST" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                }`}>
                  {ep.method}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-violet-300">{ep.path}</p>
                  <p className="text-xs text-white/40 mt-0.5">{ep.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live MCP natural-language summary */}
          {nlSummary && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 pt-4 border-t border-white/[0.05] space-y-2"
            >
              <p className="text-xs font-semibold text-white/40 mb-2">Live MCP Summary — <code className="text-cyan-400">/api/insights/summary</code></p>
              <div className="p-3 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/20">
                <p className="text-xs text-white/70 leading-relaxed">{nlSummary.summary}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-[11px] text-white/30">Total: <strong className="text-white/60">{nlSummary.metrics?.total}</strong></span>
                  <span className="text-[11px] text-white/30">Present: <strong className="text-emerald-400">{nlSummary.metrics?.present}</strong></span>
                  <span className="text-[11px] text-white/30">Rate: <strong className="text-violet-400">{nlSummary.metrics?.rate}%</strong></span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Sample NL queries */}
          <div className="mt-5 pt-4 border-t border-white/[0.05]">
            <p className="text-xs font-semibold text-white/40 mb-2">Future natural-language queries (via MCP):</p>
            <div className="flex flex-wrap gap-2">
              {data?.mcp_context?.supported_queries?.map((q, i) => (
                <span key={i} className="text-xs text-white/50 bg-white/[0.04] border border-white/[0.07] px-3 py-1.5 rounded-full">
                  &ldquo;{q}&rdquo;
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
