import { cn, fmtCurrency, fmtPct, pnlColor } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon?: LucideIcon;
  iconColor?: string;
  glow?: boolean;
}

export function StatCard({ label, value, sub, subColor, icon: Icon, iconColor, glow }: Props) {
  return (
    <div className={cn("card flex flex-col gap-3", glow && "shadow-glow border-violet-900")}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className={cn("p-2 rounded-lg", iconColor ?? "bg-violet-950")}>
            <Icon size={16} className="text-violet-400" />
          </div>
        )}
      </div>
      <div>
        <p className="stat-value">{value}</p>
        {sub && <p className={cn("text-sm mt-0.5", subColor ?? "text-zinc-500")}>{sub}</p>}
      </div>
    </div>
  );
}
