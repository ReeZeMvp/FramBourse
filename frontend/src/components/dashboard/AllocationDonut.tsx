"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GEOGRAPHY_COLORS, SECTOR_COLORS } from "@/lib/utils";

interface Props {
  data: { label: string; value: number }[];
  title: string;
  colorMap?: Record<string, string>;
}

const DEFAULT_COLORS = [
  "#7c3aed", "#eab308", "#22c55e", "#3b82f6",
  "#f97316", "#ec4899", "#06b6d4", "#84cc16",
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-bg-elevated border border-zinc-700 rounded-lg px-3 py-2 text-sm">
        <p className="font-medium text-zinc-100">{payload[0].name}</p>
        <p className="text-violet-400">{payload[0].value.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

export function AllocationDonut({ data, title, colorMap }: Props) {
  const getColor = (label: string, idx: number) =>
    colorMap?.[label] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry, idx) => (
              <Cell key={entry.label} fill={getColor(entry.label, idx)} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-zinc-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
