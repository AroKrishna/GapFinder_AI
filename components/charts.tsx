"use client";

import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const INK = "#172B4D";
const MUTED = "#52627A";
const GRID = "#EDF1F6";
const SURFACE = "#FFFFFF";
const LINE = "#315FE8";

export interface ScorePoint {
  label: string;
  score: number; // 0..100
  detail: string;
}

/** Single-series score trend: 2px line, clean markers, end label, calm academic tooltip. */
export function ScoreTrend({ data }: { data: ScorePoint[] }) {
  const last = data[data.length - 1];
  return (
    <div style={{ height: 190 }} role="img" aria-label={`Quiz scores over time: ${data.map((d) => `${d.label} ${d.score}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 40, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "#CBD5E1", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as ScorePoint;
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm">
                  <div className="font-semibold text-ink">{d.score}% · {d.label}</div>
                  <div className="mt-0.5 text-muted">{d.detail}</div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={LINE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="score"
              content={({ x, y, index }) =>
                index === data.length - 1 && last ? (
                  <text x={Number(x) + 8} y={Number(y) - 6} fill={INK} fontSize={11} fontWeight={600}>{last.score}%</text>
                ) : null
              }
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
