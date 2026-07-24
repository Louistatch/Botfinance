import {
  ClimateHistory,
  CreditType,
  IrrigationType,
  RepaymentHistory,
} from '@prisma/client';

export type QuestionType = 'text' | 'number' | 'boolean' | 'choice' | 'list';

export interface Choice {
  key: string;
  label: string;
  value: string;
}

export interface Question {
  /** Clé de stockage de la réponse dans l'accumulateur de conversation. */
  key: string;
  /** Texte de la question envoyé sur WhatsApp. */
  prompt: string;
  type: QuestionType;
  choices?: Choice[];
  /** Message d'aide en cas de réponse invalide. */
  hint?: string;
  /** Prédicat de saut : renvoie true pour ignorer la question. */
  skipIf?: (data: Record<string, any>) => boolean;
  /** Validation optionnelle : renvoie true si la valeur est acceptée. */
  validate?: (value: any) => boolean;
}

const yesNo: Choice[] = [
  { key: '1', label: 'Oui', value: 'true' },
  { key: '2', label: 'Non', value: 'false' },
];

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  FLUX CONVERSATIONNEL DYNAMIQUE DU BOT WHATSAPP
 * ─────────────────────────────────────────────────────────────────────────
 *  Le bot pose UNIQUEMENT les questions nécessaires. Les questions agricoles
 *  détaillées (rendements, irrigation) ne sont posées que si pertinent.
 *  Les variables collectées couvrent l'intégralité des critères du moteur.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const CONVERSATION_FLOW: Question[] = [
  // ── Identité de la coopérative ──
  { key: 'name', prompt: '🌾 *Bienvenue sur CreditCEP AI !*\n\nQuel est le *nom de votre coopérative* ?', type: 'text' },
  { key: 'region', prompt: 'Dans quelle *région* se situe la coopérative ? (ex: Kara)', type: 'text' },
  { key: 'prefecture', prompt: 'Quelle est la *préfecture* ? (ex: ASSOLI, Kozah, Dankpen, Daoudè)', type: 'text' },
  { key: 'village', prompt: 'Quel est le *village* ?', type: 'text' },
  { key: 'presidentName', prompt: 'Nom et prénom de la *Présidente* ?', type: 'text' },
  { key: 'memberCount', prompt: 'Combien de *membres* compte la coopérative ?', type: 'number', hint: 'Entrez un nombre entier, ex: 20.' },
  { key: 'seniorityYears', prompt: "Depuis combien d'*années* la coopérative existe-t-elle ?", type: 'number', hint: 'Ex: 2' },

  // ── Gouvernance (règles PDF) ──
  { key: 'separationOfPowers', prompt: 'Les fonctions sont-elles *séparées* (un membre ne siège pas dans deux organes) ?', type: 'boolean', choices: yesNo },
  { key: 'agHeldRegularly', prompt: "Tenez-vous une *Assemblée Générale* au moins une fois par an ?", type: 'boolean', choices: yesNo },
  { key: 'keepsRegisters', prompt: 'Tenez-vous les *registres* obligatoires (membres, cotisations, crédits) ?', type: 'boolean', choices: yesNo },
  { key: 'keepsMinutes', prompt: 'Rédigez-vous des *procès-verbaux* signés à chaque réunion ?', type: 'boolean', choices: yesNo },
  { key: 'trained', prompt: 'La coopérative a-t-elle suivi la *formation* de gestion des CEP ?', type: 'boolean', choices: yesNo },

  // ── Objet du crédit ──
  {
    key: 'creditType',
    prompt: 'Quel *type de crédit* demandez-vous ?',
    type: 'choice',
    choices: [
      { key: '1', label: 'Fond interne CEP (≤ 100 000 F, ≤ 3 mois)', value: CreditType.INTERNAL_FUND },
      { key: '2', label: 'Emprunt externe WAGES (≤ 1 000 000 F)', value: CreditType.EXTERNAL_WAGES },
    ],
  },
  { key: 'requestedAmount', prompt: 'Quel *montant* demandez-vous (en FCFA) ?', type: 'number', hint: 'Ex: 90000' },
  { key: 'purpose', prompt: "Quel est l'*objet* du crédit ?", type: 'text' },
  { key: 'proposedDuration', prompt: 'Sur combien de *mois* souhaitez-vous rembourser ?', type: 'number', hint: 'Ex: 3' },

  // ── Volet agricole ──
  { key: 'cultures', prompt: 'Quelles *cultures* pratiquez-vous ? (séparées par des virgules, ex: tomate, piment, oignon)', type: 'list' },
  { key: 'totalArea', prompt: 'Quelle est la *superficie* totale cultivée (en hectares) ?', type: 'number', hint: 'Ex: 1.5' },
  { key: 'waterAccess', prompt: "Avez-vous un *accès à l'eau* sécurisé (forage, retenue, cours d'eau) ?", type: 'boolean', choices: yesNo },
  {
    key: 'irrigationType',
    prompt: "Quel *type d'irrigation* utilisez-vous ?",
    type: 'choice',
    choices: [
      { key: '1', label: 'Goutte-à-goutte', value: IrrigationType.DRIP },
      { key: '2', label: 'Réseau californien', value: IrrigationType.CALIFORNIAN },
      { key: '3', label: 'Motopompe', value: IrrigationType.MOTOR_PUMP },
      { key: '4', label: 'Gravitaire', value: IrrigationType.GRAVITY },
      { key: '5', label: 'Manuel (arrosoir)', value: IrrigationType.MANUAL },
      { key: '6', label: 'Aucune', value: IrrigationType.NONE },
    ],
  },
  {
    key: 'climateHistory',
    prompt: "Comment décririez-vous l'*historique climatique* de votre zone ?",
    type: 'choice',
    choices: [
      { key: '1', label: 'Stable', value: ClimateHistory.STABLE },
      { key: '2', label: 'Modéré', value: ClimateHistory.MODERATE },
      { key: '3', label: 'Instable', value: ClimateHistory.UNSTABLE },
      { key: '4', label: 'Sévère (sécheresses)', value: ClimateHistory.SEVERE },
    ],
  },
  { key: 'hasEquipment', prompt: 'Disposez-vous d’*équipements* de production (brouettes, arrosoirs, kits) ?', type: 'boolean', choices: yesNo },

  // ── Volet financier ──
  { key: 'revenue', prompt: "Quel est votre *chiffre d'affaires* annuel (FCFA) ?", type: 'number', hint: 'Ex: 1500000' },
  { key: 'charges', prompt: 'Quelles sont vos *charges* annuelles (FCFA) ?', type: 'number', hint: 'Ex: 900000' },
  { key: 'savings', prompt: 'Quel est le montant de l’*épargne* cumulée de la coopérative (FCFA) ?', type: 'number', hint: 'Ex: 45000' },
  { key: 'memberContribution', prompt: 'Quel est le montant de la *cotisation* par membre (FCFA) ?', type: 'number', hint: 'Ex: 5000' },
  { key: 'mandatorySavingsUpToDate', prompt: "L'*épargne obligatoire* est-elle à jour ?", type: 'boolean', choices: yesNo },

  // ── Garanties & historique ──
  { key: 'guaranteeValue', prompt: 'Valeur estimée des *garanties* proposées (FCFA) ? (0 si aucune)', type: 'number', hint: 'Ex: 60000' },
  {
    key: 'repaymentHistory',
    prompt: 'Comment qualifiez-vous votre *historique de remboursement* ?',
    type: 'choice',
    choices: [
      { key: '1', label: 'Excellent', value: RepaymentHistory.EXCELLENT },
      { key: '2', label: 'Bon', value: RepaymentHistory.GOOD },
      { key: '3', label: 'Moyen', value: RepaymentHistory.AVERAGE },
      { key: '4', label: 'Mauvais', value: RepaymentHistory.POOR },
      { key: '5', label: 'Première demande', value: RepaymentHistory.NONE },
    ],
  },
  {
    key: 'previousDefaults',
    prompt: "Combien d'*incidents* de remboursement avez-vous connus par le passé ?",
    type: 'number',
    hint: 'Ex: 0',
    skipIf: (d) => d.repaymentHistory === RepaymentHistory.NONE,
  },
];

/** Retourne la prochaine question non encore répondue (en tenant compte des sauts). */
export function nextQuestion(data: Record<string, any>): Question | null {
  for (const q of CONVERSATION_FLOW) {
    if (q.skipIf && q.skipIf(data)) continue;
    if (data[q.key] === undefined || data[q.key] === null) {
      return q;
    }
  }
  return null;
}
