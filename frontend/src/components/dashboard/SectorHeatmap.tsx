"use client";

import { SECTOR_COLORS } from "@/lib/utils";

interface Props {
  data: { label: string; value: number }[];
}

export function SectorHeatmap({ data }: Props) {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Répartition sectorielle</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {data.map((item) => {
          const intensity = item.value / max;
          const color = SECTOR_COLORS[item.label] ?? "#6b7280";
          return (
            <div
              key={item.label}
              className="rounded-lg p-3 flex flex-col justify-between relative overflow-hidden"
              style={{
                background: `${color}${Math.round(intensity * 0.5 * 255).toString(16).padStart(2, "0")}`,
                border: `1px solid ${color}44`,
              }}
            >
              <span className="text-xs text-zinc-300 font-medium">{item.label}</span>
              <span
                className="text-xl font-bold mt-2"
                style={{ color }}
              >
                {item.value.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
