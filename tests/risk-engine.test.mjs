import assert from 'node:assert/strict';
import test from 'node:test';
import { assessLegalRisk } from '../supabase/functions/litigation-probability/risk-engine.mjs';

function score(input) {
  return assessLegalRisk(input).success_probability;
}

test('strong cheque bounce matter scores materially stronger than moderate', () => {
  const result = assessLegalRisk({
    caseFacts: 'Payee has original cheque, bank return memo for insufficient funds, written invoice, bank statement, demand notice served within limitation, and drawer admitted liability by email. Payee bank home branch is Mumbai.',
    caseType: 'Debt Recovery',
    jurisdiction: 'Mumbai',
    reliefSought: 'Damages/Compensation',
  });

  assert.ok(result.success_probability >= 78, `expected strong score, got ${result.success_probability}`);
  assert.equal(result.case_category, 'cheque_bounce');
  assert.ok(result.similar_cases.some((item) => item.name.includes('Rangappa')));
  assert.ok(result.score_explainability.some((item) => item.impact > 0));
});

test('weak verbal fraud matter is penalized for missing documentation', () => {
  const result = assessLegalRisk({
    caseFacts: 'Client alleges a verbal promise and oral investment fraud after many years. No written agreement, no receipt, no witnesses, no documents, and the location of the transaction is unclear.',
    caseType: 'Contract Breach',
    jurisdiction: '',
    reliefSought: 'Damages/Compensation',
  });

  assert.ok(result.success_probability <= 42, `expected weak score, got ${result.success_probability}`);
  assert.equal(result.case_category, 'civil_fraud');
  assert.ok(result.risk_factors.length >= 2);
});

test('strong wrongful termination matter receives labour-specific lift', () => {
  const result = assessLegalRisk({
    caseFacts: 'Employee has appointment letter, salary slips, termination letter, email trail, and witnesses. Termination happened without domestic enquiry, no show cause notice, and no hearing despite misconduct allegation.',
    caseType: 'Labour Dispute',
    jurisdiction: 'Chennai',
    reliefSought: 'Declaration',
  });

  assert.ok(result.success_probability >= 72, `expected strong labour score, got ${result.success_probability}`);
  assert.equal(result.case_category, 'labour');
  assert.ok(result.similar_cases.some((item) => item.name.includes('Firestone')));
});

test('family dispute remains calibrated rather than over-scored', () => {
  const result = assessLegalRisk({
    caseFacts: 'Woman residing in Bangalore seeks divorce and child custody. She has school records, medical records, WhatsApp messages, and some witnesses, but financial abandonment allegations need more documents.',
    caseType: 'Matrimonial',
    jurisdiction: 'Bangalore',
    reliefSought: 'Declaration',
  });

  assert.ok(result.success_probability >= 55 && result.success_probability <= 76, `expected calibrated family score, got ${result.success_probability}`);
  assert.equal(result.case_category, 'family');
});

test('false criminal accusation with objective alibi scores differently from weak civil claim', () => {
  const criminal = assessLegalRisk({
    caseFacts: 'Accused seeks quashing of false FIR. CCTV, call records, location data, and independent witnesses show alibi. FIR was delayed and contains contradictory facts and vague allegations.',
    caseType: 'Criminal Defense',
    jurisdiction: 'Delhi',
    reliefSought: 'Quashing of FIR',
  });

  const weakFraudScore = score({
    caseFacts: 'Only verbal claim, no written agreement, no proof, no witnesses, and delayed filing after many years.',
    caseType: 'Contract Breach',
    jurisdiction: '',
    reliefSought: 'Damages/Compensation',
  });

  assert.ok(criminal.success_probability >= 68, `expected meaningful criminal defense score, got ${criminal.success_probability}`);
  assert.ok(criminal.success_probability - weakFraudScore >= 25, `expected score spread, got ${criminal.success_probability} vs ${weakFraudScore}`);
  assert.ok(criminal.similar_cases.some((item) => item.name.includes('Bhajan Lal')));
});

test('core scenarios do not cluster around the same score', () => {
  const scores = [
    score({
      caseFacts: 'Original cheque, bank memo, statutory demand notice, invoice, bank statement, and admission by email.',
      caseType: 'Debt Recovery',
      jurisdiction: 'Mumbai',
      reliefSought: 'Damages/Compensation',
    }),
    score({
      caseFacts: 'Verbal promise only, no written contract, no receipt, no witnesses, delayed claim, and unclear jurisdiction.',
      caseType: 'Contract Breach',
      jurisdiction: '',
      reliefSought: 'Damages/Compensation',
    }),
    score({
      caseFacts: 'Appointment letter, salary slips, termination email, no domestic enquiry, no show cause, and two co-worker witnesses.',
      caseType: 'Labour Dispute',
      jurisdiction: 'Chennai',
      reliefSought: 'Declaration',
    }),
  ];

  const spread = Math.max(...scores) - Math.min(...scores);
  assert.ok(spread >= 30, `expected score spread >= 30, got ${spread} from ${scores.join(', ')}`);
});
