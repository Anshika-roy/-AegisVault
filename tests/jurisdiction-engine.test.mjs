import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeJurisdiction, DEFAULT_COURTS } from '../supabase/functions/court-arbitrage/jurisdiction-engine.mjs';

function analyze(caseSummary, clientState = null) {
  return analyzeJurisdiction({ caseSummary, clientState, courts: DEFAULT_COURTS });
}

test('family dispute prioritizes petitioner and respondent territorial courts', () => {
  const result = analyze(
    'A woman residing in Bangalore seeks divorce and child custody after alleging emotional abuse and financial abandonment by her spouse residing in Chennai.',
    'Karnataka',
  );

  assert.equal(result.classification.case_type, 'family');
  assert.deepEqual(result.reasoning_trace.allowed_states, ['Karnataka', 'Tamil Nadu']);
  assert.deepEqual(result.recommendations.map((rec) => rec.court_name), [
    'Karnataka High Court',
    'Madras High Court',
  ]);
  assert.ok(result.rejected_courts.some((court) => court.court_name === 'Calcutta High Court'));
  assert.ok(result.rejected_courts.some((court) => court.court_name === 'Rajasthan High Court'));
});

test('cheque bounce case anchors to payee bank branch under Section 142(2)(a)', () => {
  const result = analyze(
    'A supplier in Delhi received a bounced cheque. The payee bank home branch is in Mumbai and the drawer is in Jaipur.',
  );

  assert.equal(result.classification.case_type, 'cheque_bounce');
  assert.deepEqual(result.reasoning_trace.allowed_states, ['Maharashtra']);
  assert.deepEqual(result.recommendations.map((rec) => rec.court_name), ['Bombay High Court']);
  assert.ok(result.overall_strategy.includes('Section 142(2)'));
});

test('criminal matter uses FIR location as the strongest forum anchor', () => {
  const result = analyze('FIR registered in Delhi after accused residing in Jaipur committed fraud.');

  assert.equal(result.classification.case_type, 'criminal');
  assert.deepEqual(result.reasoning_trace.allowed_states, ['Delhi']);
  assert.equal(result.recommendations[0].court_name, 'Delhi High Court');
  assert.ok(result.rejected_courts.some((court) => court.court_name === 'Rajasthan High Court'));
});

test('IP matter still respects territorial party and infringement anchors', () => {
  const result = analyze(
    'Trademark infringement by seller in Mumbai against brand owner in Delhi seeking urgent injunction.',
  );

  assert.equal(result.classification.case_type, 'ip');
  assert.deepEqual(result.reasoning_trace.allowed_states, ['Delhi', 'Maharashtra']);
  assert.deepEqual(result.recommendations.map((rec) => rec.court_name), [
    'Bombay High Court',
    'Delhi High Court',
  ]);
  assert.ok(result.rejected_courts.every((court) => !['Delhi High Court', 'Bombay High Court'].includes(court.court_name)));
});

test('ambiguous matter remains calibrated instead of pretending certainty', () => {
  const result = analyze('A company wants to file a civil claim but has not provided party locations or cause of action facts.');

  assert.equal(result.confidence.level, 'low');
  assert.equal(result.reasoning_trace.hard_filter_applied, false);
  assert.ok(result.overall_strategy.includes('provisional') || result.overall_strategy.includes('Insufficient'));
});
