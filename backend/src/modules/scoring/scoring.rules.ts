/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RÈGLES MÉTIER OFFICIELLES — MOTEUR DE DÉCISION CreditCEP AI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Ce fichier est la SOURCE UNIQUE de vérité du moteur. Chaque seuil, poids et
 *  constante est tracé à sa source documentaire :
 *
 *   [PDF]  Support de formation « Gestion des CEP » — ProSMAT (mars 2026)
 *   [XLS]  Fichier « CEP_KARA » (structure des coopératives)
 *   [TDR]  Termes de Référence — Pilotage technico-économique ProSMAT
 *
 *  Pour ajuster la politique de crédit, il suffit de modifier ce fichier :
 *  aucune logique applicative n'a besoin d'être réécrite.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const ENGINE_VERSION = '1.0.0';

/** Devise de référence. */
export const CURRENCY = 'FCFA';

/**
 * ── PLAFONDS & CONDITIONS DE CRÉDIT ──────────────────────────────────────────
 * [PDF Module 4] Fond interne, année 1 :
 *   « Plafond du crédit : 3 fois la cotisation du membre mais ≤ 100 000 FCFA »
 *   « Durée maximale : 03 mois »   « Taux : 5% pour fond interne »
 *   « Pénalité de remboursement : 5% »
 *   Règle d'or : le crédit ne dépasse pas 2 à 3 fois le montant épargné.
 * [PDF Module 5] Emprunt externe WAGES :
 *   « jusqu'à 1 000 000 FCFA, taux dégressif de 9% l'an, différés ≤ 6 mois,
 *     investissements sur au moins 2 ans, assurance décès 0,66%, caution 10% »
 */
export const CREDIT_RULES = {
  INTERNAL_FUND: {
    /** Plafond absolu année 1 [PDF Module 4]. */
    maxAmount: 100_000,
    /** Multiple max de la cotisation du membre [PDF Module 4]. */
    maxContributionMultiple: 3,
    /** Multiple max de l'épargne (règle d'or) [PDF Module 4]. */
    maxSavingsMultiple: 3,
    /** Multiple prudent de l'épargne pour la recommandation. */
    prudentSavingsMultiple: 2,
    /** Durée maximale en mois [PDF Module 4]. */
    maxDurationMonths: 3,
    /** Différé maximal en mois. */
    maxDeferralMonths: 0,
    /** Taux annuel de base (%) [PDF Module 4]. */
    baseRate: 5,
    /** Pénalité de remboursement (%) [PDF Module 4]. */
    penaltyRate: 5,
  },
  EXTERNAL_WAGES: {
    /** Plafond WAGES [PDF Module 5]. */
    maxAmount: 1_000_000,
    maxContributionMultiple: 10,
    maxSavingsMultiple: 5,
    prudentSavingsMultiple: 3,
    /** Durée maximale (investissement ≥ 2 ans) [PDF Module 5]. */
    maxDurationMonths: 24,
    /** Différé maximal [PDF Module 5]. */
    maxDeferralMonths: 6,
    /** Taux dégressif de base (%) [PDF Module 5]. */
    baseRate: 9,
    penaltyRate: 5,
    /** Assurance décès (%) [PDF Module 5]. */
    insuranceRate: 0.66,
    /** Caution (%) [PDF Module 5]. */
    depositRate: 10,
  },
} as const;

/**
 * ── PASSEPORT DE RISQUE : PLAGE DE TAUX ──────────────────────────────────────
 * [TDR §3] « Réduction du taux d'intérêt de 24% à 10% grâce à la présentation
 *  d'un Passeport de Risque certifiant la maîtrise des probabilités de pertes. »
 * Le taux conseillé s'interpole entre le taux de base et le taux max selon le
 * niveau de risque global.
 */
export const RATE_PASSPORT = {
  min: 10, // risque faible, coopérative « bancable »
  max: 24, // risque très élevé, hors passeport
} as const;

/**
 * ── RÈGLE DE LIQUIDITÉ ───────────────────────────────────────────────────────
 * [PDF p.10] « Toujours conserver au moins 20-25% des ressources en caisse
 *  liquide ; ne pas décaisser plus de 80-90% des ressources. »
 */
export const LIQUIDITY_RULES = {
  minReserveRatio: 0.2, // 20%
  targetReserveRatio: 0.25, // 25%
  maxDisbursementRatio: 0.85, // 85%
} as const;

/**
 * ── RISQUE DE PORTEFEUILLE (PAR30) ───────────────────────────────────────────
 * [PDF p.10] « Calculer le PAR30 chaque mois ; dès qu'il dépasse 10%,
 *  déclencher un plan de recouvrement immédiat. »
 */
export const PAR30 = {
  alertThreshold: 0.1, // 10% -> alerte / recouvrement
  criticalThreshold: 0.2, // 20% -> bloquant
} as const;

/**
 * ── PONDÉRATIONS DES 11 SCORES ───────────────────────────────────────────────
 * La somme des poids vaut 1. Elles traduisent la « grille d'évaluation
 * standardisée » recommandée [PDF p.10] : capacité de remboursement, épargne
 * existante, garantie, antécédents — enrichie des dimensions agro-économiques
 * du TDR (diversification, résilience climatique, rentabilité).
 */
export const SCORE_WEIGHTS = {
  financier: 0.12,
  agricole: 0.1,
  gouvernance: 0.13,
  historique: 0.1,
  climat: 0.08,
  remboursement: 0.15, // capacité de remboursement — poids le plus fort
  production: 0.08,
  tresorerie: 0.09,
  rentabilite: 0.08,
  risque: 0.07,
} as const;

/**
 * ── SEUILS DE DÉCISION (score global /100) ───────────────────────────────────
 * Éligible ≥ 70 ; Éligible sous conditions ∈ [50 ; 70[ ; Refusé < 50.
 */
export const DECISION_THRESHOLDS = {
  eligible: 70,
  conditional: 50,
} as const;

/**
 * ── SEUILS DE NIVEAU DE RISQUE (Passeport de Risque) ─────────────────────────
 * Dérivés du score global : plus le score est haut, plus le risque est faible.
 */
export const RISK_THRESHOLDS = {
  low: 75, // score ≥ 75  -> LOW
  medium: 60, // score ≥ 60  -> MEDIUM
  high: 45, // score ≥ 45  -> HIGH ; sinon VERY_HIGH
} as const;

/**
 * ── GOUVERNANCE : BARÈME ─────────────────────────────────────────────────────
 * [PDF Module 3 & p.9] Séparation des pouvoirs, AG régulière, PV, registres,
 * formation. La séparation des pouvoirs est une exigence anti-fraude majeure.
 */
export const GOVERNANCE_POINTS = {
  separationOfPowers: 30, // « un membre ne peut siéger dans deux organes »
  agHeldRegularly: 20, // AG ≥ 1x/an
  keepsMinutes: 15, // procès-verbaux signés
  keepsRegisters: 20, // registres obligatoires tenus
  trained: 10, // formation gestion suivie
  participatesInCEP: 5, // adhésion CEP ProSMAT
} as const;

/**
 * ── TAILLE DES COOPÉRATIVES ──────────────────────────────────────────────────
 * [XLS CEP_KARA] Les CEP observées comptent 15 à 29 membres.
 */
export const MEMBERSHIP = {
  min: 15,
  ideal: 20,
  strong: 25,
} as const;

/**
 * ── HISTORIQUE DE REMBOURSEMENT : BARÈME ─────────────────────────────────────
 */
export const REPAYMENT_SCORE: Record<string, number> = {
  EXCELLENT: 100,
  GOOD: 82,
  AVERAGE: 60,
  POOR: 25,
  NONE: 55, // première demande : neutre-prudent
};

/**
 * ── IRRIGATION : BARÈME DE RÉSILIENCE ────────────────────────────────────────
 * Le maraîchage agro-écologique dépend fortement de la maîtrise de l'eau.
 */
export const IRRIGATION_SCORE: Record<string, number> = {
  DRIP: 100, // goutte-à-goutte : optimal
  CALIFORNIAN: 90, // réseau californien
  MOTOR_PUMP: 78,
  GRAVITY: 65,
  MANUAL: 45,
  NONE: 20,
};

/**
 * ── CLIMAT : BARÈME ──────────────────────────────────────────────────────────
 */
export const CLIMATE_SCORE: Record<string, number> = {
  STABLE: 100,
  MODERATE: 72,
  UNSTABLE: 45,
  SEVERE: 20,
};

/**
 * ── RÉFÉRENTIEL AGRONOMIQUE PAR DÉFAUT ───────────────────────────────────────
 * [TDR §2] Cultures maraîchères (tomate, piment, oignon, …). Sert au calcul des
 * rendements, de la diversification et du risque (volatilité du revenu = VaR).
 * Ces valeurs de référence sont surchargées par la table `culture_references`
 * lorsqu'elle est renseignée en base.
 */
export interface CultureRef {
  name: string;
  avgYield: number; // kg/ha
  price: number; // FCFA/kg
  volatility: number; // 0-1 (écart-type relatif du revenu)
  cycleMonths: number;
  waterNeed: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const DEFAULT_CULTURES: Record<string, CultureRef> = {
  tomate: { name: 'tomate', avgYield: 15000, price: 350, volatility: 0.45, cycleMonths: 4, waterNeed: 'HIGH' },
  piment: { name: 'piment', avgYield: 8000, price: 600, volatility: 0.3, cycleMonths: 4, waterNeed: 'MEDIUM' },
  oignon: { name: 'oignon', avgYield: 20000, price: 300, volatility: 0.35, cycleMonths: 5, waterNeed: 'MEDIUM' },
  gombo: { name: 'gombo', avgYield: 9000, price: 400, volatility: 0.25, cycleMonths: 3, waterNeed: 'MEDIUM' },
  laitue: { name: 'laitue', avgYield: 18000, price: 250, volatility: 0.28, cycleMonths: 2, waterNeed: 'HIGH' },
  carotte: { name: 'carotte', avgYield: 22000, price: 350, volatility: 0.22, cycleMonths: 3, waterNeed: 'MEDIUM' },
  chou: { name: 'chou', avgYield: 25000, price: 200, volatility: 0.24, cycleMonths: 3, waterNeed: 'HIGH' },
  aubergine: { name: 'aubergine', avgYield: 16000, price: 300, volatility: 0.3, cycleMonths: 4, waterNeed: 'MEDIUM' },
  poivron: { name: 'poivron', avgYield: 12000, price: 700, volatility: 0.4, cycleMonths: 4, waterNeed: 'HIGH' },
  concombre: { name: 'concombre', avgYield: 20000, price: 250, volatility: 0.26, cycleMonths: 2, waterNeed: 'HIGH' },
};

/**
 * ── DIVERSIFICATION (Markowitz) ──────────────────────────────────────────────
 * [TDR §2.2] « Optimiser le mix de production… la diversification intelligente
 *  réduit le risque de faillite en cas de chute du prix d'un légume. »
 * On récompense la diversification jusqu'à un optimum de 3-4 cultures.
 */
export const DIVERSIFICATION = {
  idealCultureCount: 4,
  minCultureCount: 2,
  highVolatilityThreshold: 0.4, // au-delà : culture « à risque »
  lowVolatilityThreshold: 0.28, // en-deçà : culture « à privilégier »
} as const;

/** Taux sans risque annualisé (proxy pour ratio de Sharpe) [TDR §3]. */
export const RISK_FREE_RATE = 0.03;
