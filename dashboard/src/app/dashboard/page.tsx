'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/Topbar';
import { DecisionPie, RiskBars, PrefectureBars } from '@/components/Charts';
import { api, getToken, API_URL } from '@/lib/api';

function decisionBadge(decision: string | null) {
  if (decision === 'ELIGIBLE') return <span className="badge eligible">Éligible</span>;
  if (decision === 'CONDITIONAL')
    return <span className="badge conditional">Sous conditions</span>;
  if (decision === 'REJECTED') return <span className="badge rejected">Refusé</span>;
  return <span className="badge gray">Non évaluée</span>;
}

function fmt(n: number | null | undefined) {
  return n != null ? Number(n).toLocaleString('fr-FR') : '—';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [mapData, setMapData] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, m, r] = await Promise.all([
        api.stats(),
        api.map(),
        api.creditRequests(),
      ]);
      setStats(s);
      setMapData(m);
      setRequests(r);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function evaluate(id: string) {
    try {
      await api.evaluate(id);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function download(kind: 'excel' | 'pdf') {
    const res = await fetch(`${API_URL}/dashboard/export/${kind}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      alert("Échec de l'export.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kind === 'excel' ? 'creditcep-export.xlsx' : 'creditcep-rapport.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar />
      <div className="container" style={{ paddingBottom: 60 }}>
        {loading && <p className="section-title">Chargement…</p>}
        {err && <div className="error" style={{ marginTop: 20 }}>{err}</div>}

        {stats && (
          <>
            <div className="row" style={{ marginTop: 24 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Vue d’ensemble
              </h2>
              <div className="spacer" />
              <button className="btn secondary" onClick={() => download('excel')}>
                ⬇ Export Excel
              </button>
              <button className="btn secondary" onClick={() => download('pdf')}>
                ⬇ Export PDF
              </button>
            </div>

            {/* KPIs */}
            <div className="grid kpi-grid mt">
              <div className="card">
                <div className="kpi-value">{stats.totals.cooperatives}</div>
                <div className="kpi-label">Coopératives</div>
              </div>
              <div className="card">
                <div className="kpi-value">{stats.totals.requests}</div>
                <div className="kpi-label">Demandes de crédit</div>
              </div>
              <div className="card">
                <div className="kpi-value">{stats.decisions.accepted}</div>
                <div className="kpi-label">Demandes acceptées</div>
              </div>
              <div className="card">
                <div className="kpi-value">{stats.decisions.rejected}</div>
                <div className="kpi-label">Demandes refusées</div>
              </div>
              <div className="card">
                <div className="kpi-value">{stats.decisions.approvalRate}%</div>
                <div className="kpi-label">Taux d’approbation</div>
              </div>
              <div className="card">
                <div className="kpi-value" style={{ fontSize: 22 }}>
                  {fmt(stats.amounts.totalRequested)}
                </div>
                <div className="kpi-label">FCFA demandés</div>
              </div>
              <div className="card">
                <div className="kpi-value" style={{ fontSize: 22 }}>
                  {fmt(stats.amounts.totalRecommended)}
                </div>
                <div className="kpi-label">FCFA recommandés</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card">
                <h3>Répartition des décisions</h3>
                <DecisionPie
                  eligible={stats.decisions.eligible}
                  conditional={stats.decisions.conditional}
                  rejected={stats.decisions.rejected}
                />
              </div>
              <div className="card">
                <h3>Niveaux de risque</h3>
                <RiskBars risk={stats.risk} />
              </div>
            </div>

            {/* Cartographie / préfectures */}
            <div className="card mt">
              <h3>Cartographie par préfecture (région Kara)</h3>
              <PrefectureBars rows={mapData} />
              <table style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Préfecture</th>
                    <th>Coopératives</th>
                    <th>Demandes</th>
                    <th>Éligibles</th>
                    <th>Score moyen</th>
                    <th>Montant demandé</th>
                  </tr>
                </thead>
                <tbody>
                  {mapData.map((m, i) => (
                    <tr key={i}>
                      <td>{m.prefecture}</td>
                      <td>{m.cooperatives}</td>
                      <td>{m.requests}</td>
                      <td>{m.eligible}</td>
                      <td>{m.avgScore || '—'}</td>
                      <td>{fmt(m.totalRequested)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table des demandes */}
            <h2 className="section-title">Demandes de crédit</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Coopérative</th>
                    <th>Préfecture</th>
                    <th>Montant</th>
                    <th>Score</th>
                    <th>Risque</th>
                    <th>Décision</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {r.reference}
                      </td>
                      <td>{r.cooperative?.name}</td>
                      <td>{r.cooperative?.prefecture}</td>
                      <td>{fmt(r.requestedAmount)} F</td>
                      <td className="score-pill">
                        {r.evaluation ? `${r.evaluation.globalScore}/100` : '—'}
                      </td>
                      <td>
                        {r.evaluation ? (
                          <span className="muted">{riskLabel(r.evaluation.riskLevel)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{decisionBadge(r.evaluation?.decision ?? null)}</td>
                      <td>
                        <button
                          className="btn secondary"
                          style={{ padding: '6px 12px', fontSize: 13 }}
                          onClick={() => evaluate(r.id)}
                        >
                          {r.evaluation ? 'Réévaluer' : 'Évaluer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="muted" style={{ textAlign: 'center' }}>
                        Aucune demande. Les demandes arrivent via WhatsApp ou l’API.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function riskLabel(r: string) {
  return { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', VERY_HIGH: 'Très élevé' }[r] ?? r;
}
