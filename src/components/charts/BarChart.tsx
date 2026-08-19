import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

const AXIS_STYLE = { fontSize: 12, fill: 'var(--muted-foreground)' };
const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

export function BarChart({
  data,
  color = '#2563eb',
  layout = 'horizontal',
  height = 260,
}: {
  data: BarDatum[];
  color?: string;
  layout?: 'horizontal' | 'vertical';
  height?: number;
}) {
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const vertical = layout === 'vertical';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        layout={layout}
        margin={{ top: 4, right: 12, bottom: 4, left: vertical ? 8 : 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={!vertical}
          vertical={vertical}
        />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              width={120}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
          </>
        )}
        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
