import {
  CONVERSATION_FLOW,
  nextQuestion,
} from '../src/modules/whatsapp/whatsapp.flow';
import { RepaymentHistory } from '@prisma/client';

describe('Flux conversationnel WhatsApp', () => {
  it('démarre par le nom de la coopérative', () => {
    expect(nextQuestion({})?.key).toBe('name');
  });

  it('progresse dans l’ordre à mesure que les réponses arrivent', () => {
    const data: Record<string, any> = {};
    const seen: string[] = [];
    let guard = 0;
    let q = nextQuestion(data);
    while (q && guard < 100) {
      seen.push(q.key);
      // Répond à la question courante avec une valeur factice cohérente.
      data[q.key] =
        q.key === 'repaymentHistory' ? RepaymentHistory.NONE : 'valeur';
      q = nextQuestion(data);
      guard++;
    }
    // Toutes les questions non sautées sont couvertes.
    expect(seen[0]).toBe('name');
    expect(seen).toContain('requestedAmount');
    expect(seen).toContain('cultures');
    expect(seen).toContain('mandatorySavingsUpToDate');
  });

  it("saute la question des incidents si c'est une première demande", () => {
    const data: Record<string, any> = {};
    // Remplit tout sauf repaymentHistory=NONE
    for (const q of CONVERSATION_FLOW) {
      if (q.key === 'previousDefaults') continue;
      data[q.key] = q.key === 'repaymentHistory' ? RepaymentHistory.NONE : 'x';
    }
    // previousDefaults doit être sauté -> plus de question.
    expect(nextQuestion(data)).toBeNull();
  });

  it('ne saute pas les incidents pour un historique existant', () => {
    const data: Record<string, any> = {};
    for (const q of CONVERSATION_FLOW) {
      if (q.key === 'previousDefaults') continue;
      data[q.key] = q.key === 'repaymentHistory' ? RepaymentHistory.GOOD : 'x';
    }
    expect(nextQuestion(data)?.key).toBe('previousDefaults');
  });
});
