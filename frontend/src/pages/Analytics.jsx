import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AttendanceTrendChart from "@/components/charts/AttendanceTrendChart";
import DepartmentChart from "@/components/charts/DepartmentChart";

const PERIODS = [
  { label: "7 days",  value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const PIE_COLORS = { present: "#10B981", late: "#F59E0B", absent: "#EF4444", half_day: "#6366F1" };

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 text-xs shadow-xl">
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-white/60 capitalize">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

import { useHierarchy } from "@/hooks/useHierarchy";

export default function Analytics() {
  const { labels } = useHierarchy();
  const [days, setDays]         = useState(30);
  const [trends, setTrends]     = useState([]);
  const [depts, setDepts]       = useState([]);
  const [perf, setPerf]         = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [t, d, p] = await Promise.all([
          analyticsApi.trends({ days }),
          analyticsApi.departments({ days }),
          analyticsApi.performance({ days }),
        ]);
        setTrends(t.data.trends || []);
        setDepts(d.data || []);
        setPerf(p.data || []);
      } catch { /* interceptor handles */ }
      finally { setLoading(false); }
    };
    loadData();
  }, [days]);

  // Aggregate status counts for pie chart
  const statusTotals = trends.reduce((acc, d) => {
    acc.present = (acc.present || 0) + (d.present || 0);
    acc.late    = (acc.late    || 0) + (d.late    || 0);
    acc.absent  = (acc.absent  || 0) + (d.absent  || 0);
    return acc;
  }, {});

  const pieData = Object.entries(statusTotals).map(([name, value]) => ({ name, value }));

  const Skeleton = ({ h = 200 }) => (
    <div className="bg-white/[0.03] rounded-xl animate-pulse" style={{ height: h }} />
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Analytics</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Attendance metrics &amp; trends</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              variant={days === p.value ? "gradient" : "outline"}
              size="sm"
              onClick={() => setDays(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Rate Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton h={240} /> : <AttendanceTrendChart data={trends} height={240} />}
        </CardContent>
      </Card>

      {/* Dept + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>{labels.department} Breakdown</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton h={220} /> : <DepartmentChart data={depts} height={220} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#7C3AED"} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "#9CA3AF" }}
                    iconType="circle" iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User performance table */}
      <Card>
        <CardHeader><CardTitle>User Performance — Top {perf.length}</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["#", "Employee", labels.department, "Present", "Late", "Absent", "Rate"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[1,2,3,4,5,6,7].map(j => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-white/[0.05] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : perf.map((u, i) => (
                  <motion.tr
                    key={u.user_id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="px-5 py-3.5 text-white/30 text-xs font-mono">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-white">{u.name}</td>
                    <td className="px-5 py-3.5 text-white/50">{u.department || "—"}</td>
                    <td className="px-5 py-3.5 text-emerald-400 font-semibold">{u.present}</td>
                    <td className="px-5 py-3.5 text-amber-400 font-semibold">{u.late}</td>
                    <td className="px-5 py-3.5 text-red-400 font-semibold">{u.absent}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden w-16">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${u.rate}%`,
                              background: u.rate >= 85 ? "#10B981" : u.rate >= 70 ? "#F59E0B" : "#EF4444"
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${u.rate >= 85 ? "text-emerald-400" : u.rate >= 70 ? "text-amber-400" : "text-red-400"}`}>
                          {u.rate}%
                        </span>
                      </div>
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
