import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, UserCheck, TrendingUp, BrainCircuit, ArrowRight, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsApi, insightsApi, attendanceApi } from "@/lib/api";
import KPICard from "@/components/shared/KPICard";
import InsightCard from "@/components/shared/InsightCard";
import AttendanceTrendChart from "@/components/charts/AttendanceTrendChart";
import DepartmentChart from "@/components/charts/DepartmentChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, isAdmin, isStaff } = useAuth();

  const [kpis, setKpis]         = useState(null);
  const [trends, setTrends]     = useState([]);
  const [depts, setDepts]       = useState([]);
  const [insights, setInsights] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const baseRequests = [
          analyticsApi.kpis(),
          attendanceApi.today(),
        ];
        if (isStaff || isAdmin) {
          baseRequests.push(
            analyticsApi.trends({ days: 14 }),
            analyticsApi.departments({ days: 30 }),
          );
        }
        const results = await Promise.all(baseRequests);
        const [kpiRes, todayRes] = results;
        const trendRes   = (isStaff || isAdmin) ? results[2] : { data: { trends: [] } };
        const deptRes    = (isStaff || isAdmin) ? results[3] : { data: [] };

        setKpis(kpiRes.data);
        setTrends(trendRes.data.trends || []);
        setDepts(deptRes.data || []);
        setTodaySummary(todayRes.data);

        if (isAdmin) {
          const insRes = await insightsApi.list();
          setInsights((insRes.data.insights || []).filter(i => !i.is_read).slice(0, 3));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isAdmin, isStaff]);

  const KPI_CARDS = [
    { title: "Total Users",     value: kpis?.total_users    ?? "—", change: kpis?.monthly_change, subtitle: "vs last month", icon: Users,       color: "violet", index: 0 },
    { title: "Present Today",   value: kpis?.present_today  ?? "—", change: kpis?.weekly_change,  subtitle: "vs last week",  icon: UserCheck,    color: "emerald",index: 1 },
    { title: "Attendance Rate", value: kpis ? `${kpis.attendance_rate}%` : "—", change: kpis?.weekly_change, subtitle: "30-day avg", icon: TrendingUp, color: "blue",   index: 2 },
    { title: "AI Insights",     value: kpis?.ai_insights_count ?? "—", change: undefined, subtitle: "unread alerts", icon: BrainCircuit, color: "amber",  index: 3 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {timeGreeting()}, {user?.name?.split(" ")[0]}
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {format(new Date(), "EEEE, MMMM d yyyy")} · Here's your team overview
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(card => <KPICard key={card.title} {...card} loading={loading} />)}
      </div>

      {/* Middle row: Trend chart + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance Trend — Last 14 Days</CardTitle>
              <Link to="/analytics" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                Full view <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading
              ? <div className="h-[220px] bg-white/[0.03] rounded-xl animate-pulse" />
              : <AttendanceTrendChart data={trends} />
            }
          </CardContent>
        </Card>

        {/* AI Insights preview */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-violet-400" />
                  AI Insights
                </CardTitle>
                <Link to="/insights" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                  All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading
                ? [1,2,3].map(i => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)
                : insights.length
                  ? insights.map((ins, i) => <InsightCard key={ins.id} insight={ins} index={i} />)
                  : <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>No unread insights</div>
              }
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom row: Departments + Today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Dept chart */}
        <Card>
          <CardHeader>
            <CardTitle>Department Attendance — 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading
              ? <div className="h-[200px] bg-white/[0.03] rounded-xl animate-pulse" />
              : <DepartmentChart data={depts} />
            }
          </CardContent>
        </Card>

        {/* Today's summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Today's Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !todaySummary
              ? <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-white/[0.03] rounded animate-pulse" />)}</div>
              : (
                <div className="space-y-3">
                  {[
                    { label: "Total Users",    value: todaySummary.total_users,  color: "var(--text-primary)" },
                    { label: "Present",        value: todaySummary.present,      color: "#34d399" },
                    { label: "Late",           value: todaySummary.late,         color: "#fbbf24" },
                    { label: "Absent",         value: todaySummary.absent,       color: "#f87171" },
                    { label: "Not Marked",     value: todaySummary.not_marked,   color: "var(--text-muted)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Attendance Rate</span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{todaySummary.attendance_rate}%</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${todaySummary.attendance_rate}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              )
            }
          </CardContent>
        </Card>

      </div>
    </motion.div>
  );
}
