'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';

const initial = {
  memberCount: 20,
  seniorityYears: 2,
  separationOfPowers: true,
  agHeldRegularly: true,
  keepsMinutes: true,
  keepsRegisters: true,
  trained: true,
  creditType: 'INTERNAL_FUND',
  requestedAmount: 90000,
  proposedDuration: 3,
  cultures: 'tomate, piment, oignon',
  totalArea: 1.5,
  waterAccess: true,
  irrigationType: 'DRIP',
  climateHistory: 'MODERATE',
  hasEquipment: true,
  revenue: 1500000,
  charges: 900000,
  savings: 45000,
  memberContribution: 5000,
  mandatorySavingsUpToDate: true,
  liquidityReserveRatio: 0.25,
  guaranteeValue: 60000,
  repaymentHistory: 'GOOD',
  previousDefaults: 0,
};

const SCORE_LABELS: Record<string, string> = {
  scoreFinancier: 'Financier',
  scoreAgricole: 'Agricole',
  scoreGouvernance: 'Gouvernance',
  scoreHistorique: 'Historique',
  scoreClimat: 'Climat',
  scoreRemboursement: 'Remboursement',
  scoreProduction: 'Production',
  scoreTresorerie: 'Trésorerie',
  scoreRentabilite: 'Rentabilité',
  scoreRisque: 'Risque',
};

export default function SimulatePage() {
  const [form, setForm] = useState<any>(initial);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  async function run() {
    setLoading(true);
    setErr('');
    try {
      const payload = {
        ...form,
        memberCount: Number(form.memberCount),
        seniorityYears: Number(form.seniorityYears),
        requestedAmount: Number(form.requestedAmount),
        proposedDuration: Number(form.proposedDuration),
        totalArea: Number(form.totalArea),
        revenue: Number(form.revenue),
        charges: Number(form.charges),
        savings: Number(form.savings),
        memberContribution: Number(form.memberContribution),
        liquidityReserveRatio: Number(form.liquidityReserveRatio),
        guaranteeValue: Number(form.guaranteeValue),
        previousDefaults: Number(form.previousDefaults),
        cultures: String(form.cultures)
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
      };
      const r = await api.simulate(payload);
      setResult(r);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const decisionClass =
    result?.decision === 'ELIGIBLE'
      ? 'eligible'
      : result?.decision === 'CONDITIONAL'
        ? 'conditional'
        : 'rejected';
  const decisionText =
    result?.decision === 'ELIGIBLE'
      ? 'Coopérative Éligible'
      : result?.decision === 'CONDITIONAL'
        ? 'Éligible sous conditions'
        : 'Non éligible';

  return (
    <>
      <Topbar />
      <div className="container" style={{ paddingBottom: 60 }}>
        <h2 className="section-title">Simulateur de décision (moteur IA)</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Saisissez un profil pour obtenir instantanément les 11 scores, la
          décision et les recommandations.
        </p>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Formulaire */}
          <div className="card">
            <h3>Paramètres de la demande</h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Membres" v={form.memberCount} on={(v) => set('memberCount', v)} type="number" />
              <Field label="Ancienneté (ans)" v={form.seniorityYears} on={(v) => set('seniorityYears', v)} type="number" />
              <Select label="Type de crédit" v={form.creditType} on={(v) => set('creditType', v)}
                options={[['INTERNAL_FUND', 'Fond interne'], ['EXTERNAL_WAGES', 'WAGES']]} />
              <Field label="Montant (FCFA)" v={form.requestedAmount} on={(v) => set('requestedAmount', v)} type="number" />
              <Field label="Durée (mois)" v={form.proposedDuration} on={(v) => set('proposedDuration', v)} type="number" />
              <Field label="Superficie (ha)" v={form.totalArea} on={(v) => set('totalArea', v)} type="number" />
              <Field label="Chiffre d'affaires" v={form.revenue} on={(v) => set('revenue', v)} type="number" />
              <Field label="Charges" v={form.charges} on={(v) => set('charges', v)} type="number" />
              <Field label="Épargne" v={form.savings} on={(v) => set('savings', v)} type="number" />
              <Field label="Cotisation/membre" v={form.memberContribution} on={(v) => set('memberContribution', v)} type="number" />
              <Field label="Réserve liquidité (0-1)" v={form.liquidityReserveRatio} on={(v) => set('liquidityReserveRatio', v)} type="number" />
              <Field label="Garanties (FCFA)" v={form.guaranteeValue} on={(v) => set('guaranteeValue', v)} type="number" />
              <Select label="Irrigation" v={form.irrigationType} on={(v) => set('irrigationType', v)}
                options={[['DRIP', 'Goutte-à-goutte'], ['CALIFORNIAN', 'Californien'], ['MOTOR_PUMP', 'Motopompe'], ['GRAVITY', 'Gravitaire'], ['MANUAL', 'Manuel'], ['NONE', 'Aucune']]} />
              <Select label="Climat" v={form.climateHistory} on={(v) => set('climateHistory', v)}
                options={[['STABLE', 'Stable'], ['MODERATE', 'Modéré'], ['UNSTABLE', 'Instable'], ['SEVERE', 'Sévère']]} />
              <Select label="Historique remb." v={form.repaymentHistory} on={(v) => set('repaymentHistory', v)}
                options={[['EXCELLENT', 'Excellent'], ['GOOD', 'Bon'], ['AVERAGE', 'Moyen'], ['POOR', 'Mauvais'], ['NONE', 'Aucun']]} />
              <Field label="Incidents passés" v={form.previousDefaults} on={(v) => set('previousDefaults', v)} type="number" />
            </div>
            <label>Cultures (séparées par des virgules)</label>
            <input value={form.cultures} onChange={(e) => set('cultures', e.target.value)} />
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
              <Check label="Séparation pouvoirs" v={form.separationOfPowers} on={(v) => set('separationOfPowers', v)} />
              <Check label="AG régulière" v={form.agHeldRegularly} on={(v) => set('agHeldRegularly', v)} />
              <Check label="Registres tenus" v={form.keepsRegisters} on={(v) => set('keepsRegisters', v)} />
              <Check label="Procès-verbaux" v={form.keepsMinutes} on={(v) => set('keepsMinutes', v)} />
              <Check label="Formation suivie" v={form.trained} on={(v) => set('trained', v)} />
              <Check label="Accès à l'eau" v={form.waterAccess} on={(v) => set('waterAccess', v)} />
              <Check label="Équipements" v={form.hasEquipment} on={(v) => set('hasEquipment', v)} />
              <Check label="Épargne oblig. à jour" v={form.mandatorySavingsUpToDate} on={(v) => set('mandatorySavingsUpToDate', v)} />
            </div>
            {err && <div className="error">{err}</div>}
            <button className="btn" style={{ width: '100%', marginTop: 16 }} onClick={run} disabled={loading}>
              {loading ? 'Analyse…' : '🧠 Lancer l’analyse'}
            </button>
          </div>

          {/* Résultat */}
          <div className="card">
            <h3>Résultat de l’évaluation</h3>
            {!result && <p className="muted">Lancez une analyse pour voir le résultat.</p>}
            {result && (
              <>
                <div className="row" style={{ marginBottom: 14 }}>
                  <span className={`badge ${decisionClass}`} style={{ fontSize: 15, padding: '8px 16px' }}>
                    {decisionText}
                  </span>
                  <div className="spacer" />
                  <div style={{ textAlign: 'right' }}>
                    <div className="kpi-value">{result.scores.globalScore}/100</div>
                    <div className="kpi-label">Risque : {riskLabel(result.riskLevel)}</div>
                  </div>
                </div>

                {/* 11 scores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(SCORE_LABELS).map(([k, label]) => (
                    <ScoreBar key={k} label={label} value={result.scores[k]} />
                  ))}
                </div>

                {/* Recommandations */}
                <div className="mt">
                  <h3 style={{ marginTop: 18 }}>Recommandations</h3>
                  <table>
                    <tbody>
                      <tr><td>Montant recommandé</td><td><b>{Number(result.recommendations.recommendedAmount).toLocaleString('fr-FR')} FCFA</b></td></tr>
                      <tr><td>Durée</td><td>{result.recommendations.recommendedDuration} mois</td></tr>
                      <tr><td>Différé</td><td>{result.recommendations.recommendedDeferral} mois</td></tr>
                      <tr><td>Taux conseillé</td><td>{result.recommendations.recommendedRate}%</td></tr>
                      <tr><td>Cultures à privilégier</td><td>{result.recommendations.favoredCultures.join(', ') || '—'}</td></tr>
                      <tr><td>Cultures à risque</td><td>{result.recommendations.riskyCultures.join(', ') || '—'}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Indicateurs quantitatifs */}
                <div className="mt">
                  <h3>Indicateurs de risque (TDR)</h3>
                  <div className="row">
                    <Indicator label="VaR 95%" value={`${Number(result.indicators.var95).toLocaleString('fr-FR')} F`} />
                    <Indicator label="Expected Shortfall" value={`${Number(result.indicators.expectedShortfall).toLocaleString('fr-FR')} F`} />
                    <Indicator label="Sharpe" value={result.indicators.sharpeRatio} />
                    <Indicator label="Diversification" value={result.indicators.diversificationIndex} />
                  </div>
                </div>

                {result.recommendations.conditions.length > 0 && (
                  <div className="mt">
                    <h3>Conditions</h3>
                    <ul style={{ paddingLeft: 18, fontSize: 14 }}>
                      {result.recommendations.conditions.map((c: string, i: number) => (
                        <li key={i} style={{ marginBottom: 4 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt card" style={{ background: 'var(--gray-50)' }}>
                  <b>Justification</b>
                  <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{result.justification}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? '#16a34a' : value >= 50 ? '#d97706' : '#dc2626';
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ background: 'var(--gray-100)', borderRadius: 6, height: 8 }}>
        <div style={{ width: `${value}%`, background: color, height: 8, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: any }) {
  return (
    <div className="card" style={{ padding: 12, flex: 1, minWidth: 120 }}>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function Field({
  label,
  v,
  on,
  type = 'text',
}: {
  label: string;
  v: any;
  on: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function Select({
  label,
  v,
  on,
  options,
}: {
  label: string;
  v: any;
  on: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label>{label}</label>
      <select value={v} onChange={(e) => on(e.target.value)}>
        {options.map(([val, lbl]: [string, string]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>
    </div>
  );
}

function Check({
  label,
  v,
  on,
}: {
  label: string;
  v: boolean;
  on: (value: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontWeight: 400, cursor: 'pointer' }}>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} style={{ width: 'auto' }} />
      {label}
    </label>
  );
}

function riskLabel(r: string) {
  return { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', VERY_HIGH: 'Très élevé' }[r] ?? r;
}
