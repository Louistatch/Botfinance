import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { Decision, RequestSource, RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditRequestsService } from '../credit-requests/credit-requests.service';
import { CONVERSATION_FLOW, nextQuestion, Question } from './whatsapp.flow';
import { CREDIT_RULES } from '../scoring/scoring.rules';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  BOT WHATSAPP — CreditCEP AI (Baileys)
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Connexion multi-device via QR Code (persistée sur disque).
 *  - Machine conversationnelle dynamique : ne pose que les questions utiles.
 *  - À la fin du questionnaire : création de la coopérative + demande, exécution
 *    du moteur de scoring, et restitution de la décision motivée.
 *
 *  La logique conversationnelle (`processIncoming`) est découplée du transport
 *  Baileys pour rester testable sans connexion réelle.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WhatsApp');
  private sock: any;
  private currentQrDataUrl: string | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' =
    'disconnected';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly creditRequests: CreditRequestsService,
  ) {}

  async onModuleInit() {
    if (!this.config.get<boolean>('whatsapp.enabled')) {
      this.logger.warn('Bot WhatsApp désactivé (WHATSAPP_ENABLED=false).');
      return;
    }
    // Démarrage non bloquant pour ne pas retarder le boot de l'API.
    this.startSocket().catch((err) =>
      this.logger.error('Échec démarrage Baileys', err as Error),
    );
  }

  async onModuleDestroy() {
    try {
      await this.sock?.end?.();
    } catch {
      /* ignore */
    }
  }

  // ───────────────────────── ÉTAT / QR ─────────────────────────

  getStatus() {
    return {
      state: this.connectionState,
      hasQr: !!this.currentQrDataUrl,
      device: this.config.get<string>('whatsapp.deviceName'),
    };
  }

  getQrDataUrl(): string | null {
    return this.currentQrDataUrl;
  }

  // ───────────────────────── CONNEXION BAILEYS ─────────────────────────

  private async startSocket() {
    this.connectionState = 'connecting';
    // Import dynamique : évite un crash si le module natif n'est pas présent.
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
      baileys;

    const authDir = this.config.get<string>('whatsapp.authDir')!;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: [this.config.get<string>('whatsapp.deviceName')!, 'Chrome', '1.0'],
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.currentQrDataUrl = await QRCode.toDataURL(qr);
        this.logger.log('Nouveau QR Code généré — scannez-le (GET /whatsapp/qr).');
        // Affichage terminal facultatif.
        try {
          const qrt = await import('qrcode-terminal');
          qrt.default.generate(qr, { small: true });
        } catch {
          /* optionnel */
        }
      }
      if (connection === 'open') {
        this.connectionState = 'connected';
        this.currentQrDataUrl = null;
        this.logger.log('Bot WhatsApp connecté.');
      }
      if (connection === 'close') {
        this.connectionState = 'disconnected';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(
          `Connexion fermée (code ${statusCode}). Reconnexion: ${shouldReconnect}`,
        );
        if (shouldReconnect) {
          setTimeout(() => this.startSocket().catch(() => undefined), 3000);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async (m: any) => {
      try {
        await this.handleUpsert(m);
      } catch (err) {
        this.logger.error('Erreur traitement message', err as Error);
      }
    });
  }

  private async handleUpsert(m: any) {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid as string;
      if (jid.endsWith('@g.us')) continue; // ignore les groupes
      const text =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        '';
      const phone = jid.split('@')[0];
      const reply = await this.processIncoming(phone, text.trim());
      await this.sock.sendMessage(jid, { text: reply });
    }
  }

  // ───────────────────────── MOTEUR CONVERSATIONNEL ─────────────────────────

  /**
   * Traite un message entrant et renvoie la réponse texte du bot.
   * Testable indépendamment de Baileys.
   */
  async processIncoming(phone: string, text: string): Promise<string> {
    const convo = await this.prisma.whatsappConversation.upsert({
      where: { phone },
      create: { phone, state: 'NEW', data: {} },
      update: { lastMessageAt: new Date() },
    });

    const lower = text.trim().toLowerCase();
    const data = (convo.data as Record<string, any>) ?? {};

    // ── Commandes globales (disponibles partout) ──
    if (['menu', 'start', 'bonjour', 'salut', 'accueil', 'recommencer', 'restart'].includes(lower)) {
      await this.setState(phone, 'MENU', {});
      return this.welcome() + '\n\n' + this.menu();
    }
    if (['annuler', 'cancel', 'stop', 'quitter'].includes(lower)) {
      await this.setState(phone, 'MENU', {});
      return 'Action annulée.\n\n' + this.menu();
    }

    // ── Premier contact / après une action : afficher le menu ──
    if (['NEW', 'DONE', 'IDLE', 'START'].includes(convo.state)) {
      await this.setState(phone, 'MENU', {});
      return this.welcome() + '\n\n' + this.menu();
    }

    // ── L'utilisateur est dans le menu : interpréter son choix ──
    if (convo.state === 'MENU') {
      return this.handleMenuChoice(phone, lower);
    }

    // ── Consultation d'une demande existante ──
    if (convo.state === 'AWAIT_REFERENCE') {
      return this.lookupRequest(phone, text.trim());
    }

    // ── Questionnaire de demande de crédit en cours ──
    if (convo.state === 'IN_PROGRESS') {
      const current = nextQuestion(data);
      if (!current) return this.finalize(phone, data);

      const parsed = this.parseAnswer(current, text);
      if (parsed.error) {
        return `${parsed.error}\n\n${this.render(current)}`;
      }
      data[current.key] = parsed.value;
      await this.prisma.whatsappConversation.update({
        where: { phone },
        data: { data },
      });

      const upcoming = nextQuestion(data);
      if (!upcoming) return this.finalize(phone, data);
      return this.render(upcoming);
    }

    // ── Repli : retour au menu ──
    await this.setState(phone, 'MENU', {});
    return this.menu();
  }

  /** Met à jour l'état (et éventuellement les données) d'une conversation. */
  private async setState(
    phone: string,
    state: string,
    data?: Record<string, any>,
  ) {
    await this.prisma.whatsappConversation.update({
      where: { phone },
      data: { state, completed: false, ...(data !== undefined ? { data } : {}) },
    });
  }

  /** Interprète le choix de l'utilisateur dans le menu principal. */
  private async handleMenuChoice(phone: string, choice: string): Promise<string> {
    switch (choice) {
      case '1':
      case 'demande':
        await this.setState(phone, 'IN_PROGRESS', {});
        return (
          'Nouvelle demande de crédit. Répondez ANNULER pour revenir au menu.\n\n' +
          this.render(CONVERSATION_FLOW[0])
        );
      case '2':
      case 'consulter':
        await this.setState(phone, 'AWAIT_REFERENCE', {});
        return 'Indiquez la référence de votre demande (par exemple DEM-2026-000123).';
      case '3':
      case 'conditions':
        return this.infoCredit() + '\n\n' + this.backHint();
      case '4':
      case 'conseiller':
      case 'contact':
        return this.contact() + '\n\n' + this.backHint();
      default:
        return 'Choix non reconnu. Merci de répondre par un numéro.\n\n' + this.menu();
    }
  }

  /** Recherche et restitue le statut d'une demande à partir de sa référence. */
  private async lookupRequest(phone: string, ref: string): Promise<string> {
    const request = await this.prisma.creditRequest.findUnique({
      where: { reference: ref.toUpperCase() },
      include: { cooperative: true, evaluation: true },
    });
    await this.setState(phone, 'MENU');

    if (!request) {
      return (
        `Aucune demande trouvée pour la référence « ${ref} ».\n\n` + this.menu()
      );
    }
    if (!request.evaluation) {
      return (
        `Demande ${request.reference} — ${request.cooperative.name}\n` +
        "Statut : en cours d'analyse.\n\n" +
        this.backHint()
      );
    }
    return (
      this.formatDecision(request.reference, request.evaluation) +
      '\n\n' +
      this.backHint()
    );
  }

  /** Valide et convertit la réponse selon le type de question. */
  private parseAnswer(
    q: Question,
    raw: string,
  ): { value?: any; error?: string } {
    const text = raw.trim();
    if (!text) return { error: 'Réponse vide. Merci de répondre.' };

    switch (q.type) {
      case 'number': {
        const cleaned = text.replace(/[^\d.,-]/g, '').replace(',', '.');
        const n = Number(cleaned);
        if (Number.isNaN(n)) return { error: q.hint ?? 'Entrez un nombre valide.' };
        return { value: n };
      }
      case 'boolean': {
        if (['1', 'oui', 'o', 'yes', 'y'].includes(text.toLowerCase()))
          return { value: true };
        if (['2', 'non', 'n', 'no'].includes(text.toLowerCase()))
          return { value: false };
        return { error: 'Répondez *1* (Oui) ou *2* (Non).' };
      }
      case 'choice': {
        const choice = q.choices?.find(
          (c) =>
            c.key === text ||
            c.label.toLowerCase() === text.toLowerCase() ||
            c.value.toLowerCase() === text.toLowerCase(),
        );
        if (!choice) return { error: 'Choisissez un numéro dans la liste.' };
        return { value: choice.value };
      }
      case 'list': {
        const items = text
          .split(/[,;\n]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (items.length === 0) return { error: 'Indiquez au moins une culture.' };
        return { value: items };
      }
      default:
        return { value: text };
    }
  }

  /** Rend le texte d'une question (avec ses choix numérotés). */
  private render(q: Question): string {
    let out = q.prompt;
    if (q.choices && (q.type === 'choice' || q.type === 'boolean')) {
      out += '\n' + q.choices.map((c) => `  *${c.key}*. ${c.label}`).join('\n');
    }
    return out;
  }

  private welcome(): string {
    return (
      '*CreditCEP AI*\n' +
      'Service d’analyse et d’octroi de crédit agricole pour les coopératives ' +
      '(CEP / ProSMAT).'
    );
  }

  /** Menu principal des fonctionnalités. */
  private menu(): string {
    return (
      '*Menu principal*\n\n' +
      'Répondez avec le numéro de votre choix :\n' +
      '1. Faire une demande de crédit\n' +
      '2. Consulter une demande existante\n' +
      '3. Conditions et plafonds de crédit\n' +
      '4. Contacter un conseiller\n\n' +
      'À tout moment, répondez MENU pour revenir ici.'
    );
  }

  private backHint(): string {
    return 'Répondez MENU pour revenir au menu principal.';
  }

  /** Rappel des conditions de crédit (valeurs officielles CEP / ProSMAT). */
  private infoCredit(): string {
    const i = CREDIT_RULES.INTERNAL_FUND;
    const w = CREDIT_RULES.EXTERNAL_WAGES;
    return (
      '*Conditions et plafonds de crédit*\n\n' +
      '*Fond interne CEP (première année)*\n' +
      `- Montant maximum : ${i.maxAmount.toLocaleString('fr-FR')} FCFA\n` +
      `- Plafond : ${i.maxContributionMultiple} fois la cotisation du membre\n` +
      `- Durée maximale : ${i.maxDurationMonths} mois\n` +
      `- Taux d’intérêt : ${i.baseRate} %\n\n` +
      '*Financement externe (WAGES)*\n' +
      `- Montant maximum : ${w.maxAmount.toLocaleString('fr-FR')} FCFA\n` +
      `- Taux dégressif : ${w.baseRate} % par an\n` +
      `- Différé possible : jusqu’à ${w.maxDeferralMonths} mois\n` +
      `- Caution : ${w.depositRate} %\n\n` +
      'Le montant accordé ne dépasse pas 2 à 3 fois l’épargne du membre. ' +
      'L’épargne obligatoire à jour conditionne l’accès au crédit.'
    );
  }

  /** Informations de contact / accompagnement. */
  private contact(): string {
    return (
      '*Contacter un conseiller*\n\n' +
      'Un conseiller de votre Caisse Endogène Paysanne (CEP) peut vous ' +
      'accompagner dans le montage de votre dossier.\n' +
      'Rapprochez-vous du bureau de votre coopérative (Présidente ou ' +
      'Trésorière), ou de votre union régionale ProSMAT.'
    );
  }

  // ───────────────────────── FINALISATION & SCORING ─────────────────────────

  /**
   * Crée la coopérative et la demande, exécute le moteur puis renvoie la
   * décision formatée pour WhatsApp.
   */
  private async finalize(phone: string, data: Record<string, any>): Promise<string> {
    // 1) Coopérative
    const coop = await this.prisma.cooperative.create({
      data: {
        code: `COOP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        name: data.name ?? 'Coopérative',
        region: data.region ?? 'Kara',
        prefecture: data.prefecture ?? 'ASSOLI',
        village: data.village ?? null,
        memberCount: Math.round(data.memberCount ?? 15),
        presidentName: data.presidentName ?? 'N/A',
        presidentPhone: phone,
        contactPhone: phone,
        seniorityYears: Math.round(data.seniorityYears ?? 0),
        separationOfPowers: !!data.separationOfPowers,
        agHeldRegularly: !!data.agHeldRegularly,
        keepsMinutes: !!data.keepsMinutes,
        keepsRegisters: !!data.keepsRegisters,
        trained: !!data.trained,
        participatesInCEP: true,
      },
    });

    // 2) Demande de crédit
    const request = await this.creditRequests.create({
      cooperativeId: coop.id,
      creditType: data.creditType,
      requestedAmount: data.requestedAmount ?? 0,
      purpose: data.purpose ?? 'Non précisé',
      proposedDuration: data.proposedDuration
        ? Math.round(data.proposedDuration)
        : undefined,
      cultures: data.cultures ?? [],
      totalArea: data.totalArea,
      waterAccess: !!data.waterAccess,
      irrigationType: data.irrigationType,
      climateHistory: data.climateHistory,
      hasEquipment: !!data.hasEquipment,
      revenue: data.revenue,
      charges: data.charges,
      savings: data.savings ?? 0,
      memberContribution: data.memberContribution ?? 0,
      mandatorySavingsUpToDate: !!data.mandatorySavingsUpToDate,
      guaranteeValue: data.guaranteeValue,
      repaymentHistory: data.repaymentHistory,
      previousDefaults: data.previousDefaults
        ? Math.round(data.previousDefaults)
        : 0,
      source: RequestSource.WHATSAPP,
      submittedByPhone: phone,
    });

    // 3) Scoring
    const { evaluation } = await this.creditRequests.evaluate(request.id);

    // 4) Persistance de l'état conversationnel (retour au menu ensuite)
    await this.prisma.whatsappConversation.update({
      where: { phone },
      data: {
        completed: false,
        state: 'MENU',
        cooperativeId: coop.id,
        lastRequestId: request.id,
      },
    });

    return this.formatDecision(request.reference, evaluation);
  }

  /** Met en forme la décision pour l'affichage WhatsApp (ton sobre, professionnel). */
  private formatDecision(reference: string, e: any): string {
    const decisionLabel: Record<Decision, string> = {
      ELIGIBLE: 'Éligible',
      CONDITIONAL: 'Éligible sous conditions',
      REJECTED: 'Non éligible',
    };
    const riskLabel: Record<RiskLevel, string> = {
      LOW: 'Faible',
      MEDIUM: 'Moyen',
      HIGH: 'Élevé',
      VERY_HIGH: 'Très élevé',
    };
    const score = Number(e.globalScore).toLocaleString('fr-FR', {
      maximumFractionDigits: 2,
    });

    const lines: string[] = [];
    lines.push('*Résultat de l’analyse*');
    lines.push('');
    lines.push(`Référence : ${reference}`);
    lines.push(`Décision : *${decisionLabel[e.decision as Decision]}*`);
    lines.push(`Score global : ${score} / 100`);
    lines.push(`Niveau de risque : ${riskLabel[e.riskLevel as RiskLevel]}`);

    if (e.decision !== Decision.REJECTED) {
      lines.push('');
      lines.push('*Recommandations de financement*');
      lines.push(`- Montant conseillé : ${Number(e.recommendedAmount).toLocaleString('fr-FR')} FCFA`);
      lines.push(`- Durée : ${e.recommendedDuration} mois`);
      if (e.recommendedDeferral) lines.push(`- Différé : ${e.recommendedDeferral} mois`);
      lines.push(`- Taux conseillé : ${e.recommendedRate} %`);
    }

    const conditions = (e.conditions as string[]) ?? [];
    if (e.decision === Decision.CONDITIONAL && conditions.length) {
      lines.push('');
      lines.push('*Conditions à remplir*');
      conditions.slice(0, 5).forEach((c) => lines.push(`- ${c}`));
    }

    const techs = (e.technicalRecommendations as string[]) ?? [];
    if (techs.length) {
      lines.push('');
      lines.push('*Recommandations techniques*');
      techs.slice(0, 3).forEach((t) => lines.push(`- ${t}`));
    }

    lines.push('');
    lines.push('Répondez MENU pour revenir au menu principal.');
    return lines.join('\n');
  }
}
