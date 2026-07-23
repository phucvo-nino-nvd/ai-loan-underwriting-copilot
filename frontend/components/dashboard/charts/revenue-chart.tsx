"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AssessmentRecord } from "@/lib/underwriting";

interface PDDataPoint {
  month: string;
  pd: number;
  appetite: number;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const RISK_APPETITE = 0.04; // 4%

export function RevenueChart({
  assessments,
}: {
  assessments: AssessmentRecord[];
}) {
  const data: PDDataPoint[] = useMemo(() => {
    const groups = new Map<string, AssessmentRecord[]>();

    for (const a of assessments) {
      const key = monthKey(a.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }

    if (groups.size === 0) return [];

    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    return sorted.map(([, records]) => {
      const avgPd =
        records.reduce((sum, r) => sum + r.probability, 0) / records.length;
      return {
        month: monthLabel(records[0].createdAt),
        pd: avgPd,
        appetite: RISK_APPETITE,
      };
    });
  }, [assessments]);

  return (
    <div className="bg-card/40 border border-border/60 p-5 h-[380px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Average PD Trend
          </h3>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-1">
            Monthly portfolio PD vs risk appetite
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-chart-1" />
            <span className="text-muted-foreground">Average PD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-chart-2" />
            <span className="text-muted-foreground">Risk Appetite</span>
          </div>
        </div>
      </div>

      <div className="h-[280px]">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No assessment data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="pdGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="oklch(0.7 0.18 220)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="oklch(0.7 0.18 220)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="appetiteGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="oklch(0.7 0.18 145)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="oklch(0.7 0.18 145)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                strokeOpacity={0.85}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                tickFormatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.12 0.005 260)",
                  border: "1px solid oklch(0.22 0.005 260)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "oklch(0.95 0 0)", fontWeight: 600 }}
                itemStyle={{ color: "oklch(0.65 0 0)" }}
                formatter={(value: number) => [
                  `${(value * 100).toFixed(2)}%`,
                  "",
                ]}
              />
              <Area
                type="monotone"
                dataKey="appetite"
                stroke="oklch(0.7 0.18 145)"
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="url(#appetiteGradient)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="pd"
                stroke="oklch(0.7 0.18 220)"
                strokeWidth={2}
                fill="url(#pdGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
