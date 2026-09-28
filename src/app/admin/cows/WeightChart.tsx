"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function WeightChart({ data }: { data: { date: string; weightKg: number }[] }) {
  if (data.length < 2) return null;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#737373" }} axisLine={{ stroke: "#e5e5e4" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Weight"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e5e5e4", fontSize: 13 }}
          />
          <Line type="monotone" dataKey="weightKg" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
