import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { DashboardService } from './dashboard.service';

// Polices standard (intégrées à pdfmake via les fontes AFM par défaut).
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

@Injectable()
export class ExportService {
  constructor(private readonly dashboard: DashboardService) {}

  /** Génère un classeur Excel des demandes et de leurs évaluations. */
  async toExcel(): Promise<Buffer> {
    const rows = await this.dashboard.exportRows();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'CreditCEP AI';
    wb.created = new Date();

    const ws = wb.addWorksheet('Demandes de crédit');
    ws.columns = [
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Coopérative', key: 'cooperative', width: 28 },
      { header: 'Région', key: 'region', width: 12 },
      { header: 'Préfecture', key: 'prefecture', width: 14 },
      { header: 'Présidente', key: 'president', width: 24 },
      { header: 'Type', key: 'creditType', width: 16 },
      { header: 'Montant demandé', key: 'requestedAmount', width: 18 },
      { header: 'Objet', key: 'purpose', width: 30 },
      { header: 'Statut', key: 'status', width: 14 },
      { header: 'Score /100', key: 'globalScore', width: 12 },
      { header: 'Risque', key: 'riskLevel', width: 12 },
      { header: 'Décision', key: 'decision', width: 16 },
      { header: 'Montant recommandé', key: 'recommendedAmount', width: 20 },
      { header: 'Taux (%)', key: 'recommendedRate', width: 10 },
      { header: 'Date', key: 'createdAt', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF166534' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const r of rows) {
      ws.addRow({
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 16) : '',
      });
    }

    // Feuille synthèse
    const stats = await this.dashboard.stats();
    const summary = wb.addWorksheet('Synthèse');
    summary.addRows([
      ['Indicateur', 'Valeur'],
      ['Coopératives', stats.totals.cooperatives],
      ['Demandes totales', stats.totals.requests],
      ['Demandes évaluées', stats.totals.evaluated],
      ['Éligibles', stats.decisions.eligible],
      ['Éligibles sous conditions', stats.decisions.conditional],
      ['Refusées', stats.decisions.rejected],
      ["Taux d'approbation (%)", stats.decisions.approvalRate],
      ['Montant total demandé (FCFA)', stats.amounts.totalRequested],
      ['Montant total recommandé (FCFA)', stats.amounts.totalRecommended],
    ]);
    summary.getRow(1).font = { bold: true };

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Génère un rapport PDF de synthèse. */
  async toPdf(): Promise<Buffer> {
    const [rows, stats] = await Promise.all([
      this.dashboard.exportRows(),
      this.dashboard.stats(),
    ]);
    const printer = new PdfPrinter(fonts);

    const tableBody: any[] = [
      [
        { text: 'Référence', bold: true },
        { text: 'Coopérative', bold: true },
        { text: 'Préfecture', bold: true },
        { text: 'Montant', bold: true },
        { text: 'Score', bold: true },
        { text: 'Décision', bold: true },
      ],
      ...rows.slice(0, 200).map((r) => [
        r.reference,
        r.cooperative,
        r.prefecture,
        `${r.requestedAmount.toLocaleString('fr-FR')} F`,
        r.globalScore != null ? `${r.globalScore}` : '-',
        this.decisionLabel(r.decision),
      ]),
    ];

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [30, 40, 30, 40],
      content: [
        { text: 'CreditCEP AI', style: 'brand' },
        { text: 'Rapport de synthèse des demandes de crédit', style: 'title' },
        {
          text: `Généré le ${new Date().toLocaleString('fr-FR')}`,
          style: 'muted',
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            this.kpi('Coopératives', stats.totals.cooperatives),
            this.kpi('Demandes', stats.totals.requests),
            this.kpi('Éligibles', stats.decisions.accepted),
            this.kpi('Taux appro.', `${stats.decisions.approvalRate}%`),
          ],
          margin: [0, 0, 0, 16],
        },
        {
          text: `Montant total demandé : ${stats.amounts.totalRequested.toLocaleString('fr-FR')} FCFA`,
          margin: [0, 0, 0, 4],
        },
        {
          text: `Montant total recommandé : ${stats.amounts.totalRecommended.toLocaleString('fr-FR')} FCFA`,
          margin: [0, 0, 0, 16],
        },
        {
          table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'], body: tableBody },
          layout: 'lightHorizontalLines',
          fontSize: 8,
        },
      ],
      styles: {
        brand: { fontSize: 20, bold: true, color: '#166534' },
        title: { fontSize: 14, bold: true, margin: [0, 4, 0, 2] },
        muted: { fontSize: 9, color: '#6b7280' },
        kpiValue: { fontSize: 16, bold: true, color: '#166534' },
        kpiLabel: { fontSize: 9, color: '#6b7280' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    return new Promise((resolve, reject) => {
      const doc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  private kpi(label: string, value: string | number) {
    return {
      stack: [
        { text: String(value), style: 'kpiValue' },
        { text: label, style: 'kpiLabel' },
      ],
    };
  }

  private decisionLabel(d: string | null): string {
    switch (d) {
      case 'ELIGIBLE':
        return 'Éligible';
      case 'CONDITIONAL':
        return 'Sous conditions';
      case 'REJECTED':
        return 'Refusé';
      default:
        return '-';
    }
  }
}
