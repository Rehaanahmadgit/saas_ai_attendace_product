import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 text-xs shadow-xl border-white/10">
      <p className="text-white/50 mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70 capitalize">{p.name}:</span>
          <span className="text-white font-semibold">{p.name === "rate" ? `${p.value}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AttendanceTrendChart({ data = [], height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6B7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#6B7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#9CA3AF", paddingTop: "12px" }}
          iconType="circle"
          iconSize={8}
        />

        <Area
          type="monotone"
          dataKey="rate"
          name="Attendance Rate"
          stroke="#7C3AED"
          fill="url(#gradPresent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#7C3AED", stroke: "#fff", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="late"
          name="Late"
          stroke="#F59E0B"
          fill="url(#gradLate)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: "#F59E0B" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
