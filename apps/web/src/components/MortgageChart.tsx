'use client';

import { fmtEur, type ScheduleRow } from '@immo/calc';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const k = (x: number) => `${Math.round(x / 1000).toLocaleString('de-DE')}k`;

export function MortgageChart({
  rows,
  fixedRateYears,
}: {
  rows: ScheduleRow[];
  fixedRateYears: number;
}) {
  const data = rows.map((r) => ({ ...r, fixed: r.year <= fixedRateYears }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="flow" tickFormatter={k} tick={{ fontSize: 12 }} width={44} />
          <YAxis
            yAxisId="balance"
            orientation="right"
            tickFormatter={k}
            tick={{ fontSize: 12 }}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => [fmtEur(Number(v)), name]}
            labelFormatter={(y) =>
              `Year ${y}${Number(y) <= fixedRateYears ? ' (Zinsbindung)' : ''}`
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="flow" dataKey="interest" name="Interest" stackId="a" fill="#f59e0b" />
          <Bar yAxisId="flow" dataKey="principal" name="Tilgung" stackId="a" fill="#0ea5e9" />
          <Line
            yAxisId="balance"
            dataKey="endBalance"
            name="Remaining balance"
            stroke="#0f172a"
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
