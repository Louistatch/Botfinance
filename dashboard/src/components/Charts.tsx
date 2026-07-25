'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const GREEN = '#16a34a';
const AMBER = '#d97706';
const RED = '#dc2626';
const SLATE = '#64748b';

export function DecisionPie({
  eligible,
  conditional,
  rejected,
}: {
  eligible: number;
  conditional: number;
  rejected: number;
}) {
  const data = [
    { name: 'Éligible', value: eligible, color: GREEN },
    { name: 'Sous conditions', value: conditional, color: AMBER },
    { name: 'Refusé', value: rejected, color: RED },
  ];
  const total = eligible + conditional + rejected;
  if (total === 0) return <p className="muted">Aucune évaluation pour l’instant.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RiskBars({ risk }: { risk: any }) {
  const data = [
    { name: 'Faible', value: risk.low, color: GREEN },
    { name: 'Moyen', value: risk.medium, color: '#65a30d' },
    { name: 'Élevé', value: risk.high, color: AMBER },
    { name: 'Très élevé', value: risk.veryHigh, color: RED },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <XAxis dataKey="name" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrefectureBars({ rows }: { rows: any[] }) {
  const data = rows.map((r) => ({
    name: r.prefecture,
    Demandes: r.requests,
    Éligibles: r.eligible,
  }));
  if (data.length === 0) return <p className="muted">Aucune donnée cartographique.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <XAxis dataKey="name" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Demandes" fill={SLATE} radius={[6, 6, 0, 0]} />
        <Bar dataKey="Éligibles" fill={GREEN} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
