import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/format';

// Ordem e cores fixas para "para onde vai cada real" em todo o sistema
// (Dashboard, Formação de Preço, Mix de Preços) — mesma pergunta, mesmo
// gráfico, para que o usuário não precise reaprender a legenda em cada tela.
export const COST_COMPOSITION_COLORS = ['#94a3b8', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];

export type CostCompositionItem = { name: string; value: number };

const SIZES = {
  sm: { height: 160, inner: 40, outer: 70 },
  md: { height: 256, inner: 60, outer: 90 },
  lg: { height: 256, inner: 60, outer: 100 },
} as const;

export default function CostCompositionChart({
  data,
  size = 'md',
  legendLayout = 'grid-2',
  showValues = true,
}: {
  data: CostCompositionItem[];
  size?: keyof typeof SIZES;
  legendLayout?: 'grid-2' | 'list';
  showValues?: boolean;
}) {
  const dims = SIZES[size];

  return (
    <div>
      <div style={{ height: dims.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={dims.inner}
              outerRadius={dims.outer}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COST_COMPOSITION_COLORS[index % COST_COMPOSITION_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className={legendLayout === 'grid-2' ? 'mt-4 grid grid-cols-2 gap-2' : 'mt-4 space-y-2'}>
        {data.map((item, i) => (
          <div
            key={i}
            className={legendLayout === 'grid-2' ? 'flex items-center gap-2 text-xs' : 'flex items-center justify-between text-sm'}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COST_COMPOSITION_COLORS[i % COST_COMPOSITION_COLORS.length] }}
              />
              <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
            </div>
            {showValues && <span className="font-semibold text-foreground shrink-0">{formatCurrency(item.value)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
