"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function LactationChart({ data }: { data: { date: string; litres: number }[] }) {
  if (data.length < 2) return <p className="text-sm text-neutral-400">Not enough recorded days yet for a trend.</p>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#737373" }}
            axisLine={{ stroke: "#e5e5e4" }}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()} L`, "Litres"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Line type="monotone" dataKey="litres" stroke="#15803d" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
