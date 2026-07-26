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
      create: { phone, state: 'START', data: {} },
      update: { lastMessageAt: new Date() },
    });

    const lower = text.toLowerCase();
    const data = (convo.data as Record<string, any>) ?? {};

    // Commandes globales
    if (['start', 'menu', 'bonjour', 'salut', 'recommencer', 'restart'].includes(lower)) {
      await this.prisma.whatsappConversation.update({
        where: { phone },
        data: { state: 'IN_PROGRESS', data: {}, completed: false },
      });
      return this.welcome() + '\n\n' + this.render(CONVERSATION_FLOW[0]);
    }
    if (['annuler', 'cancel', 'stop'].includes(lower)) {
      await this.prisma.whatsappConversation.update({
        where: { phone },
        data: { state: 'IDLE', data: {}, completed: false },
      });
      return 'Demande annulée. Répondez START pour en soumettre une nouvelle.';
    }

    if (convo.completed) {
      return 'Votre demande a déjà été analysée. Répondez START pour en soumettre une nouvelle.';
    }

    // Détermine la question courante
    const current = nextQuestion(data);
    if (!current) {
      return this.finalize(phone, data);
    }

    // Si on est au tout début et le message n'est pas une commande, on démarre.
    if (convo.state === 'START' || convo.state === 'IDLE') {
      await this.prisma.whatsappConversation.update({
        where: { phone },
        data: { state: 'IN_PROGRESS' },
      });
      return this.welcome() + '\n\n' + this.render(current);
    }

    // Parse la réponse à la question courante
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
    if (!upcoming) {
      return this.finalize(phone, data);
    }
    return this.render(upcoming);
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
      '*CreditCEP AI* — Analyse de crédit agricole\n\n' +
      'Bonjour. Je vais recueillir quelques informations sur votre coopérative ' +
      'afin d’évaluer votre demande de crédit.\n' +
      'Pour annuler à tout moment, répondez ANNULER.'
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

    // 4) Persistance de l'état conversationnel
    await this.prisma.whatsappConversation.update({
      where: { phone },
      data: {
        completed: true,
        state: 'DONE',
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
    lines.push('Pour soumettre une nouvelle demande, répondez START.');
    return lines.join('\n');
  }
}
