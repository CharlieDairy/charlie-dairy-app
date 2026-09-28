"use client";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
export default function DailyProductionChart({ data }: { data: { date: string; produced: number | null; sold: number | null }[] }) {
  return <div className="h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e2e8f0"/><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} tick={{ fontSize: 11 }}/><YAxis width={45} tick={{ fontSize: 11 }} unit="L"/><Tooltip/><Legend/><Area name="Produced" dataKey="produced" stroke="#0d9488" fill="#ccfbf1" connectNulls={false}/><Line name="Sold" dataKey="sold" stroke="#0ea5e9" strokeDasharray="5 4" dot={false} connectNulls={false}/></ComposedChart></ResponsiveContainer></div>;
}
