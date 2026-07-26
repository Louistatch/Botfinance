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
  { key: 'name', prompt: 'Quel est le *nom de votre coopérative* ?', type: 'text' },
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

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  MODULES DE FORMATION — gestion & gouvernance des CEP
 * ─────────────────────────────────────────────────────────────────────────
 *  Contenu de sensibilisation destiné aux membres (les femmes se forment
 *  régulièrement au fonctionnement de leur caisse). Fidèle au Règlement de
 *  fonctionnement de la CEP et au manuel de gestion ProSMAT / CTOP.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface FormationModule {
  title: string;
  content: string;
}

export const FORMATION_MODULES: FormationModule[] = [
  {
    title: 'Les organes de la CEP',
    content:
      '*Les organes de la CEP*\n\n' +
      'La Caisse Endogène Paysanne est structurée en deux organes.\n\n' +
      '*Assemblée Générale (AG)* — tous les membres, présidée par la ' +
      'Présidente. Elle :\n' +
      '- élabore et approuve le règlement de fonctionnement ;\n' +
      '- élit les membres du Comité de gestion ;\n' +
      '- définit les orientations (cotisations, crédit) ;\n' +
      '- valide le rapport d’activités et les comptes ;\n' +
      '- décide des admissions, suspensions et radiations.\n\n' +
      '*Comité de gestion* — cinq membres (Présidente, Vice-présidente, ' +
      'Secrétaire, Trésorière, Trésorière-adjointe), assistés de trois ' +
      'détentrices de clés et deux compteuses. Mandat d’un à trois ans, ' +
      'renouvelable une fois. Il assure la gestion hebdomadaire et l’étude ' +
      'préalable des demandes de crédit.',
  },
  {
    title: 'Le bureau et ses rôles',
    content:
      '*Le bureau et ses rôles*\n\n' +
      '*Présidente* : représente la CEP, dirige les réunions et le comité ' +
      'd’étude, signe les documents, supervise les activités.\n' +
      '*Vice-présidente* : remplace la Présidente en son absence.\n' +
      '*Secrétaire* : correspondance, procès-verbaux, registre des membres, ' +
      'analyse des dossiers de crédit.\n' +
      '*Trésorière* : tient le journal des mouvements de fonds, suit les ' +
      'comptes, présente le bilan, vérifie la caissette en fin de réunion.\n' +
      '*Trésorière-adjointe* : garde la caissette, tamponne les livrets, ' +
      'remplace la Trésorière.\n' +
      '*Compteuses (2)* : comptent l’argent collecté ou remis en réunion.\n' +
      '*Détentrices de clés (3)* : chacune garde une clé ; la caissette ne ' +
      's’ouvre qu’avec les trois clés réunies.',
  },
  {
    title: 'Adhésion, cotisations et épargne',
    content:
      '*Adhésion, cotisations et épargne*\n\n' +
      'L’adhésion est volontaire ; un groupe compte de 15 à 25 membres ' +
      'partageant des objectifs communs.\n\n' +
      '- *Droit d’adhésion* : fixé par l’AG, non remboursable.\n' +
      '- *Cotisation obligatoire* : versement périodique fixe (hebdomadaire), ' +
      'condition d’accès au crédit.\n' +
      '- *Cotisation volontaire* : dépôt libre, dans une fourchette définie.\n\n' +
      'Les cotisations constituent le fonds commun qui finance les prêts et ' +
      'les projets de la communauté. En fin de cycle, cotisations et intérêts ' +
      'sont partagés au prorata des contributions de chaque membre.',
  },
  {
    title: 'Le crédit',
    content:
      '*Le crédit*\n\n' +
      'Le crédit soutient le maraîchage agro-écologique (production, ' +
      'transformation, commercialisation), le commerce, l’artisanat et les ' +
      'services : semences, intrants, main-d’œuvre, petit matériel.\n\n' +
      '*Analyse du dossier* : moralité, rentabilité de l’activité, ' +
      'solvabilité et capacité de remboursement. La demande passe par la ' +
      'Secrétaire, est évaluée par le Comité de gestion, puis décidée en AG.\n\n' +
      '*Modalités (première année)* :\n' +
      '- plafond : 3 fois la cotisation, sans dépasser 100 000 FCFA ;\n' +
      '- durée maximale : 3 mois ;\n' +
      '- pénalité en cas de retard ;\n' +
      '- remboursement en fin de période ou étalé selon les revenus.',
  },
  {
    title: 'Gouvernance et bonnes pratiques',
    content:
      '*Gouvernance et bonnes pratiques*\n\n' +
      'Une bonne gouvernance protège la caisse et la confiance des membres :\n\n' +
      '- *Séparation des pouvoirs* : un même membre ne cumule pas deux ' +
      'fonctions incompatibles.\n' +
      '- *Assemblée Générale régulière* : comptes présentés et votés.\n' +
      '- *Procès-verbaux* signés à chaque réunion.\n' +
      '- *Registres tenus à jour* : membres, cotisations, crédits.\n' +
      '- *Transparence* : « pas de pièce, pas d’écriture » ; la caissette ne ' +
      's’ouvre qu’avec les trois clés.\n' +
      '- Les autorités locales ne siègent pas au Comité de gestion, afin de ' +
      'rester arbitres en cas de conflit.',
  },
  {
    title: 'Le cycle de la CEP',
    content:
      '*Le cycle de la CEP*\n\n' +
      '*Début de cycle* : AG de lancement — approbation du rapport de ' +
      'l’année précédente, élection du Comité de gestion, présentation du ' +
      'plan d’activités et du budget, adhésions et formation des nouveaux ' +
      'membres.\n\n' +
      '*Pendant le cycle* : réunion hebdomadaire obligatoire (épargne, ' +
      'demandes de prêt, décisions communautaires).\n\n' +
      '*Fin de cycle* : bilan des activités et bilan financier, distribution ' +
      'des fonds au prorata des cotisations, fête de clôture, puis ' +
      'préparation du cycle suivant.',
  },
];
