'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';

const RISK: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
  VERY_HIGH: 'Très élevé',
};

function fmt(n: any) {
  return n != null ? Number(n).toLocaleString('fr-FR') : '—';
}

function decisionBadge(d: string | null) {
  if (d === 'ELIGIBLE') return <span className="badge eligible">Éligible</span>;
  if (d === 'CONDITIONAL')
    return <span className="badge conditional">Sous conditions</span>;
  if (d === 'REJECTED') return <span className="badge rejected">Refusé</span>;
  return <span className="badge gray">Non évaluée</span>;
}

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [req, setReq] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setReq(await api.creditRequest(id));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function evaluate() {
    try {
      await api.evaluate(id);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const e = req?.evaluation;
  const coop = req?.cooperative;

  return (
    <>
      <Topbar />
      <div className="container" style={{ paddingBottom: 60 }}>
        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn secondary" onClick={() => router.push('/dashboard')}>
            ← Retour
          </button>
          <div className="spacer" />
          <button className="btn" onClick={evaluate}>
            {e ? 'Réévaluer' : 'Évaluer'}
          </button>
        </div>

        {loading && <p className="section-title">Chargement…</p>}
        {err && <div className="error" style={{ marginTop: 20 }}>{err}</div>}

        {req && (
          <>
            <h2 className="section-title">
              {coop?.name}{' '}
              <span style={{ fontFamily: 'monospace', fontSize: 15, color: 'var(--gray-500)' }}>
                {req.reference}
              </span>
            </h2>

            {/* Infos demande + coopérative */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card">
                <h3>Coopérative</h3>
                <table>
                  <tbody>
                    <tr><td>Région / Préfecture</td><td>{coop?.region} · {coop?.prefecture}</td></tr>
                    <tr><td>Village</td><td>{coop?.village ?? '—'}</td></tr>
                    <tr><td>Présidente</td><td>{coop?.presidentName}</td></tr>
                    <tr><td>Membres</td><td>{coop?.memberCount}</td></tr>
                    <tr><td>Ancienneté</td><td>{coop?.seniorityYears} an(s)</td></tr>
                    <tr><td>Gouvernance</td><td>
                      {[coop?.separationOfPowers && 'Séparation pouvoirs', coop?.agHeldRegularly && 'AG régulière',
                        coop?.keepsRegisters && 'Registres', coop?.keepsMinutes && 'PV', coop?.trained && 'Formée']
                        .filter(Boolean).join(', ') || '—'}
                    </td></tr>
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Demande</h3>
                <table>
                  <tbody>
                    <tr><td>Type</td><td>{req.creditType === 'INTERNAL_FUND' ? 'Fond interne' : 'WAGES'}</td></tr>
                    <tr><td>Montant demandé</td><td><b>{fmt(req.requestedAmount)} FCFA</b></td></tr>
                    <tr><td>Objet</td><td>{req.purpose}</td></tr>
                    <tr><td>Cultures</td><td>{(req.cultures ?? []).join(', ') || '—'}</td></tr>
                    <tr><td>Superficie</td><td>{req.totalArea ?? '—'} ha</td></tr>
                    <tr><td>Épargne</td><td>{fmt(req.savings)} FCFA</td></tr>
                    <tr><td>CA / Charges</td><td>{fmt(req.revenue)} / {fmt(req.charges)} FCFA</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {!e && (
              <div className="card mt">
                <p className="muted">
                  Cette demande n’a pas encore été évaluée. Cliquez sur « Évaluer ».
                </p>
              </div>
            )}

            {e && (
              <>
                {/* Décision */}
                <div className="card mt">
                  <div className="row">
                    {decisionBadge(e.decision)}
                    <div className="spacer" />
                    <div style={{ textAlign: 'right' }}>
                      <span className="kpi-value">{e.globalScore}/100</span>
                      <div className="kpi-label">Risque : {RISK[e.riskLevel]}</div>
                    </div>
                  </div>
                  <p style={{ marginTop: 12, lineHeight: 1.6, fontSize: 14 }}>{e.justification}</p>
                </div>

                {/* 11 scores */}
                <div className="card mt">
                  <h3>Détail des scores</h3>
                  <table>
                    <thead>
                      <tr><th>Dimension</th><th>Score</th><th>Poids</th><th>Commentaire</th></tr>
                    </thead>
                    <tbody>
                      {(e.breakdown ?? []).map((b: any) => (
                        <tr key={b.key}>
                          <td>{b.label}</td>
                          <td>
                            <ScoreCell value={b.score} />
                          </td>
                          <td>{Math.round(b.weight * 100)}%</td>
                          <td className="muted" style={{ fontSize: 13 }}>{b.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Flags */}
                {(e.flags ?? []).length > 0 && (
                  <div className="card mt">
                    <h3>Règles & alertes déclenchées</h3>
                    <ul style={{ listStyle: 'none' }}>
                      {(e.flags ?? []).map((f: any, i: number) => (
                        <li key={i} style={{ padding: '6px 0', display: 'flex', gap: 8 }}>
                          <span className={`badge ${f.severity === 'BLOCKING' ? 'rejected' : f.severity === 'WARNING' ? 'conditional' : 'gray'}`}>
                            {f.severity}
                          </span>
                          <span style={{ fontSize: 14 }}>{f.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommandations */}
                <div className="grid mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="card">
                    <h3>Recommandations de financement</h3>
                    <table>
                      <tbody>
                        <tr><td>Montant recommandé</td><td><b>{fmt(e.recommendedAmount)} FCFA</b></td></tr>
                        <tr><td>Durée</td><td>{e.recommendedDuration} mois</td></tr>
                        <tr><td>Différé</td><td>{e.recommendedDeferral} mois</td></tr>
                        <tr><td>Taux conseillé</td><td>{e.recommendedRate}%</td></tr>
                        <tr><td>Cultures à privilégier</td><td>{(e.favoredCultures ?? []).join(', ') || '—'}</td></tr>
                        <tr><td>Cultures à risque</td><td>{(e.riskyCultures ?? []).join(', ') || '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="card">
                    <h3>Indicateurs de risque (TDR)</h3>
                    <table>
                      <tbody>
                        <tr><td>VaR 95%</td><td>{fmt(e.var95)} FCFA</td></tr>
                        <tr><td>Expected Shortfall</td><td>{fmt(e.expectedShortfall)} FCFA</td></tr>
                        <tr><td>Ratio de Sharpe</td><td>{e.sharpeRatio}</td></tr>
                        <tr><td>Diversification</td><td>{e.diversificationIndex}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Listes de recommandations */}
                <div className="grid mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <RecoList title="Conseils techniques" items={e.technicalRecommendations} />
                  <RecoList title="Conseils financiers" items={e.financialRecommendations} />
                  <RecoList title="Garanties complémentaires" items={e.additionalGuarantees} />
                  {(e.conditions ?? []).length > 0 && (
                    <RecoList title="Conditions à remplir" items={e.conditions} />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ScoreCell({ value }: { value: number }) {
  const color = value >= 70 ? '#16a34a' : value >= 50 ? '#d97706' : '#dc2626';
  return <span style={{ fontWeight: 700, color }}>{value}</span>;
}

function RecoList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card">
      <h3>{title}</h3>
      <ul style={{ paddingLeft: 18, fontSize: 14 }}>
        {items.map((it, i) => (
          <li key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
