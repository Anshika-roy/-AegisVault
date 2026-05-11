const CATEGORY_WEIGHTS = {
  cheque_bounce: {
    evidence_strength: 0.25,
    procedural_compliance: 0.28,
    jurisdiction_advantage: 0.12,
    precedent_strength: 0.14,
    relief_likelihood: 0.14,
    litigation_risk: 0.07,
  },
  labour: {
    evidence_strength: 0.24,
    procedural_compliance: 0.20,
    jurisdiction_advantage: 0.10,
    precedent_strength: 0.16,
    relief_likelihood: 0.18,
    litigation_risk: 0.12,
  },
  criminal_defense: {
    evidence_strength: 0.30,
    procedural_compliance: 0.14,
    jurisdiction_advantage: 0.08,
    precedent_strength: 0.16,
    relief_likelihood: 0.16,
    litigation_risk: 0.16,
  },
  family: {
    evidence_strength: 0.22,
    procedural_compliance: 0.12,
    jurisdiction_advantage: 0.16,
    precedent_strength: 0.12,
    relief_likelihood: 0.20,
    litigation_risk: 0.18,
  },
  commercial: {
    evidence_strength: 0.30,
    procedural_compliance: 0.16,
    jurisdiction_advantage: 0.12,
    precedent_strength: 0.14,
    relief_likelihood: 0.18,
    litigation_risk: 0.10,
  },
  property: {
    evidence_strength: 0.28,
    procedural_compliance: 0.16,
    jurisdiction_advantage: 0.16,
    precedent_strength: 0.12,
    relief_likelihood: 0.16,
    litigation_risk: 0.12,
  },
  constitutional: {
    evidence_strength: 0.18,
    procedural_compliance: 0.22,
    jurisdiction_advantage: 0.16,
    precedent_strength: 0.18,
    relief_likelihood: 0.14,
    litigation_risk: 0.12,
  },
  civil_fraud: {
    evidence_strength: 0.32,
    procedural_compliance: 0.12,
    jurisdiction_advantage: 0.10,
    precedent_strength: 0.10,
    relief_likelihood: 0.18,
    litigation_risk: 0.18,
  },
};

const CURATED_PRECEDENTS = [
  {
    category: 'cheque_bounce',
    name: 'Rangappa v. Sri Mohan (2010)',
    outcome: 'statutory presumption recognized',
    key_takeaway: 'Section 139 presumption supports the complainant when cheque execution and statutory ingredients are shown.',
    tokens: ['cheque', 'dishonour', '138', '139', 'debt', 'liability', 'notice', 'bank memo'],
  },
  {
    category: 'cheque_bounce',
    name: 'C.C. Alavi Haji v. Palapetty Muhammed (2007)',
    outcome: 'notice defence narrowed',
    key_takeaway: 'Notice objections are weaker where statutory service facts and later opportunity to pay are present.',
    tokens: ['cheque', 'notice', 'service', 'demand notice', '138'],
  },
  {
    category: 'labour',
    name: 'Workmen of Firestone Tyre & Rubber Co. v. Management (1973)',
    outcome: 'domestic enquiry principles',
    key_takeaway: 'Termination risk turns heavily on domestic enquiry, natural justice, and proportionality of punishment.',
    tokens: ['termination', 'domestic enquiry', 'misconduct', 'natural justice', 'dismissal', 'workman'],
  },
  {
    category: 'family',
    name: 'Gaurav Nagpal v. Sumedha Nagpal (2008)',
    outcome: 'child welfare emphasis',
    key_takeaway: 'Custody analysis is driven by welfare of the child rather than mechanical parental entitlement.',
    tokens: ['custody', 'child', 'welfare', 'visitation', 'minor'],
  },
  {
    category: 'family',
    name: 'Samar Ghosh v. Jaya Ghosh (2007)',
    outcome: 'mental cruelty framework',
    key_takeaway: 'Mental cruelty requires fact-sensitive proof of conduct and impact, not bare matrimonial allegations.',
    tokens: ['divorce', 'cruelty', 'mental cruelty', 'matrimonial', 'spouse'],
  },
  {
    category: 'criminal_defense',
    name: 'State of Haryana v. Bhajan Lal (1992)',
    outcome: 'FIR quashing framework',
    key_takeaway: 'Quashing is strongest where allegations do not disclose an offence or proceedings appear abusive on admitted facts.',
    tokens: ['false fir', 'quashing', '482', 'abuse of process', 'vague allegations', 'criminal complaint'],
  },
  {
    category: 'constitutional',
    name: 'Kusum Ingots & Alloys Ltd. v. Union of India (2004)',
    outcome: 'cause-of-action jurisdiction',
    key_takeaway: 'Writ jurisdiction depends on whether a material part of the cause of action arises within the High Court territory.',
    tokens: ['writ', 'article 226', 'cause of action', 'jurisdiction', 'government'],
  },
];

const POSITIVE_SIGNALS = [
  { key: 'written_agreement', weight: 16, evidence: 16, pattern: /\b(written agreement|contract|signed|agreement|appointment letter|employment contract|lease deed|sale deed)\b/ },
  { key: 'documentary_proof', weight: 14, evidence: 14, pattern: /\b(document|documentary|invoice|receipt|bank statement|email|letter|memo|salary slip|wage slip|termination letter|medical record)\b/ },
  { key: 'digital_evidence', weight: 10, evidence: 10, pattern: /\b(email|whatsapp|sms|cctv|call recording|digital|chat|screenshots?|metadata)\b/ },
  { key: 'witness_support', weight: 8, evidence: 8, pattern: /\b(witness|independent witness|co-worker|neighbour|eyewitness)\b/ },
  { key: 'timeline_consistency', weight: 8, evidence: 6, pattern: /\b(within|same day|immediately|contemporaneous|timeline|dated|chronology)\b/ },
  { key: 'statutory_notice', weight: 16, procedural: 18, pattern: /\b(legal notice|demand notice|statutory notice|notice served|served notice)\b/ },
  { key: 'bank_return_memo', weight: 12, evidence: 12, procedural: 10, pattern: /\b(bank memo|return memo|dishonou?r memo|insufficient funds|account closed|stop payment)\b/ },
  { key: 'domestic_enquiry_defect', weight: 14, procedural: 14, relief: 8, pattern: /\b(no domestic enquiry|without enquiry|no show cause|natural justice|no hearing)\b/ },
  { key: 'alibi_or_exculpatory', weight: 18, evidence: 18, relief: 10, pattern: /\b(alibi|elsewhere|cctv|location data|call records|contradictory fir|contradiction|false accusation)\b/ },
  { key: 'jurisdiction_anchor', weight: 10, jurisdiction: 16, pattern: /\b(jurisdiction|branch|workplace|fir registered|cause of action|residing in|registered office|property located)\b/ },
];

const NEGATIVE_SIGNALS = [
  { key: 'verbal_only', penalty: 22, evidence: 24, risk: 10, pattern: /\b(verbal|oral|no written|nothing in writing|handshake)\b/ },
  { key: 'missing_documents', penalty: 18, evidence: 18, risk: 8, pattern: /\b(no documents|missing documents|lost documents|no proof|without proof|unsupported)\b/ },
  { key: 'missing_notice', penalty: 18, procedural: 20, pattern: /\b(no notice|notice not sent|failed to send notice|without legal notice)\b/ },
  { key: 'delay_or_laches', penalty: 14, procedural: 8, risk: 12, pattern: /\b(delayed|after many years|stale|limitation expired|time-barred|laches)\b/ },
  { key: 'contradictory_facts', penalty: 16, evidence: 8, risk: 18, pattern: /\b(contradictory|inconsistent|changed version|different versions|contradiction)\b/ },
  { key: 'jurisdiction_unclear', penalty: 12, jurisdiction: 18, risk: 6, pattern: /\b(unclear jurisdiction|wrong jurisdiction|different state|unknown location|not sure where)\b/ },
  { key: 'admission_against_interest', penalty: 18, evidence: 10, risk: 18, pattern: /\b(client admitted|our client admitted|self admission|confessed|apology)\b/ },
  { key: 'no_witness', penalty: 10, evidence: 10, pattern: /\b(no witness|no witnesses)\b/ },
];

function clamp(value, min = 15, max = 92) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function classifyCase(text, selectedType = '') {
  const combined = `${selectedType} ${text}`.toLowerCase();
  if (/\b(cheque|check|dishonou?r|bounce|section 138|ni act|bank memo)\b/.test(combined)) return 'cheque_bounce';
  if (/\b(termination|wrongful termination|labou?r|employee|employer|wages|salary|retrenchment|domestic enquiry|workman)\b/.test(combined)) return 'labour';
  if (/\b(false fir|quashing|criminal defense|bail|accused|fir|criminal complaint|false accusation)\b/.test(combined)) return 'criminal_defense';
  if (/\b(divorce|custody|matrimonial|maintenance|spouse|wife|husband|child welfare|domestic violence)\b/.test(combined)) return 'family';
  if (/\b(fraud|misrepresentation|cheating|verbal promise|oral promise)\b/.test(combined)) return 'civil_fraud';
  if (/\b(property|title|possession|sale deed|lease|tenant|land)\b/.test(combined)) return 'property';
  if (/\b(writ|article 226|constitutional|government|public authority|fundamental right)\b/.test(combined)) return 'constitutional';
  return 'commercial';
}

function detectSignals(text) {
  const positives = POSITIVE_SIGNALS.filter((signal) => signal.pattern.test(text));
  const negatives = NEGATIVE_SIGNALS.filter((signal) => signal.pattern.test(text));
  return { positives, negatives };
}

function categoryAdjustments(category, text, relief) {
  const adjustments = {
    evidence_strength: 0,
    procedural_compliance: 0,
    jurisdiction_advantage: 0,
    precedent_strength: 0,
    relief_likelihood: 0,
    litigation_risk: 0,
    notes: [],
  };

  if (category === 'cheque_bounce') {
    if (includesAny(text, ['cheque', 'bank memo', 'return memo', 'legal notice', 'demand notice'])) {
      adjustments.procedural_compliance += 16;
      adjustments.precedent_strength += 12;
      adjustments.relief_likelihood += 10;
      adjustments.notes.push('+16 procedural compliance for NI Act ingredients being pleaded');
    }
    if (!includesAny(text, ['legal notice', 'demand notice', 'notice served'])) {
      adjustments.procedural_compliance -= 22;
      adjustments.relief_likelihood -= 12;
      adjustments.notes.push('-22 procedural compliance because statutory demand notice is not identified');
    }
  }

  if (category === 'labour') {
    if (includesAny(text, ['appointment letter', 'salary slip', 'termination letter', 'no domestic enquiry', 'no show cause'])) {
      adjustments.evidence_strength += 12;
      adjustments.relief_likelihood += 12;
      adjustments.notes.push('+12 evidence strength for employment records and termination trail');
    }
    if (includesAny(text, ['no domestic enquiry', 'without enquiry', 'natural justice'])) {
      adjustments.precedent_strength += 16;
      adjustments.procedural_compliance += 14;
      adjustments.notes.push('+16 precedent strength for domestic-enquiry defect theory');
    }
  }

  if (category === 'criminal_defense') {
    if (includesAny(text, ['cctv', 'alibi', 'location data', 'call records', 'contradictory fir', 'delayed fir'])) {
      adjustments.evidence_strength += 18;
      adjustments.relief_likelihood += 14;
      adjustments.litigation_risk += 10;
      adjustments.notes.push('+18 evidence strength for objective exculpatory material');
    }
    if (includesAny(text, ['serious injury', 'weapon', 'recovery', 'eyewitness against'])) {
      adjustments.litigation_risk -= 18;
      adjustments.relief_likelihood -= 12;
      adjustments.notes.push('-18 litigation risk because prosecution-side gravity signals are present');
    }
  }

  if (category === 'family') {
    if (includesAny(text, ['child', 'custody', 'school', 'medical', 'primary caregiver'])) {
      adjustments.relief_likelihood += 10;
      adjustments.evidence_strength += 6;
      adjustments.notes.push('+10 relief likelihood for child-welfare facts being pleaded');
    }
    if (includesAny(text, ['only allegation', 'no record', 'no complaint'])) {
      adjustments.evidence_strength -= 10;
      adjustments.notes.push('-10 evidence strength because matrimonial allegations need corroborating context');
    }
  }

  if (category === 'civil_fraud') {
    if (includesAny(text, ['verbal', 'oral', 'no written', 'cash', 'no receipt'])) {
      adjustments.evidence_strength -= 18;
      adjustments.relief_likelihood -= 16;
      adjustments.litigation_risk -= 12;
      adjustments.notes.push('-18 evidence strength for oral/verbal fraud theory without documents');
    }
  }

  if (/\b(interim injunction|stay|bail|quashing|specific performance)\b/i.test(relief || '')) {
    adjustments.procedural_compliance += 4;
    adjustments.relief_likelihood += 4;
    adjustments.notes.push('+4 relief likelihood because the requested relief is procedurally identifiable');
  }

  return adjustments;
}

function buildScores({ category, text, jurisdiction, relief }) {
  const { positives, negatives } = detectSignals(text);
  const scores = {
    evidence_strength: 42,
    procedural_compliance: 46,
    jurisdiction_advantage: jurisdiction ? 58 : 42,
    precedent_strength: 40,
    relief_likelihood: relief ? 52 : 44,
    litigation_risk: 58,
  };

  const contributions = [];

  for (const signal of positives) {
    scores.evidence_strength += signal.evidence || 0;
    scores.procedural_compliance += signal.procedural || 0;
    scores.jurisdiction_advantage += signal.jurisdiction || 0;
    scores.relief_likelihood += signal.relief || 0;
    contributions.push({ label: signal.key, impact: signal.weight, type: 'positive', reason: `Detected ${signal.key.replaceAll('_', ' ')}.` });
  }

  for (const signal of negatives) {
    if (category === 'criminal_defense' && ['contradictory_facts', 'delay_or_laches'].includes(signal.key)) {
      contributions.push({ label: `${signal.key}_helps_defense`, impact: 8, type: 'positive', reason: `Detected ${signal.key.replaceAll('_', ' ')} in prosecution/FIR facts; treated as a defence-side support signal.` });
      scores.relief_likelihood += 8;
      scores.litigation_risk += 6;
      continue;
    }
    scores.evidence_strength -= signal.evidence || 0;
    scores.procedural_compliance -= signal.procedural || 0;
    scores.jurisdiction_advantage -= signal.jurisdiction || 0;
    scores.litigation_risk -= signal.risk || 0;
    contributions.push({ label: signal.key, impact: -signal.penalty, type: 'negative', reason: `Detected ${signal.key.replaceAll('_', ' ')}.` });
  }

  const categoryAdjust = categoryAdjustments(category, text, relief);
  for (const key of Object.keys(scores)) {
    scores[key] += categoryAdjust[key] || 0;
  }
  for (const note of categoryAdjust.notes) {
    const impact = Number(note.match(/[+-]\d+/)?.[0] || 0);
    contributions.push({ label: note.replace(/^[+-]\d+\s*/, ''), impact, type: impact >= 0 ? 'positive' : 'negative', reason: note });
  }

  const precedentMatches = matchPrecedents(category, text);
  if (precedentMatches[0]?.similarity >= 65) {
    scores.precedent_strength += 28;
    contributions.push({ label: 'direct precedent match', impact: 18, type: 'positive', reason: `Curated match: ${precedentMatches[0].name}.` });
  } else if (precedentMatches[0]?.similarity >= 50) {
    scores.precedent_strength += 18;
    contributions.push({ label: 'indirect precedent support', impact: 10, type: 'positive', reason: `Partial curated match: ${precedentMatches[0].name}.` });
  } else {
    scores.precedent_strength -= 8;
    contributions.push({ label: 'no strong direct precedent', impact: -8, type: 'negative', reason: 'No curated precedent crossed the confidence threshold.' });
  }

  for (const key of Object.keys(scores)) {
    scores[key] = clamp(scores[key], 15, 95);
  }

  const weights = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.commercial;
  const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + scores[key] * weight, 0);
  const negativeDrag = Math.min(
    14,
    contributions.filter((item) => item.impact < 0).reduce((sum, item) => sum + Math.abs(item.impact), 0) * 0.08,
  );
  const positiveLift = Math.min(
    12,
    contributions.filter((item) => item.impact > 0).reduce((sum, item) => sum + item.impact, 0) * 0.045,
  );
  const finalScore = clamp(weighted + positiveLift - negativeDrag, 18, 92);

  return { scores, weights, contributions, precedentMatches, finalScore };
}

function matchPrecedents(category, text) {
  return CURATED_PRECEDENTS
    .filter((precedent) => precedent.category === category)
    .map((precedent) => {
      const hits = precedent.tokens.filter((token) => text.includes(token)).length;
      const similarity = Math.round((hits / precedent.tokens.length) * 100);
      return { ...precedent, similarity };
    })
    .filter((precedent) => precedent.similarity >= 35)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2);
}

function factorReason(key, score, category) {
  const level = score >= 75 ? 'strong' : score >= 55 ? 'moderate' : score >= 40 ? 'fragile' : 'weak';
  const map = {
    evidence_strength: `${level} evidence posture based on documents, digital proof, witnesses, and consistency signals.`,
    procedural_compliance: `${level} procedural posture for the ${category.replaceAll('_', ' ')} workflow.`,
    jurisdiction_advantage: `${level} jurisdiction posture based on territorial and subject-matter alignment.`,
    precedent_strength: `${level} precedent posture using only the curated internal precedent set.`,
    relief_likelihood: `${level} relief feasibility based on statutory maintainability and enforceability signals.`,
    litigation_risk: `${level} residual risk profile after delay, contradiction, and missing-document penalties.`,
  };
  return map[key] || `${level} factor score.`;
}

function verdict(score) {
  if (score >= 78) return 'likely favorable';
  if (score <= 42) return 'likely unfavorable';
  return 'uncertain';
}

function confidence(score, contributions, precedentMatches) {
  const negativeCount = contributions.filter((item) => item.impact < 0).length;
  const positiveCount = contributions.filter((item) => item.impact > 0).length;
  if (positiveCount >= 4 && negativeCount <= 1 && precedentMatches[0]?.similarity >= 50) return 'high';
  if (score < 40 || negativeCount >= 3) return 'low';
  return 'moderate';
}

function durationFor(category, score) {
  const strong = score >= 70;
  const table = {
    cheque_bounce: strong ? '6-14 months' : '12-24 months',
    labour: strong ? '8-18 months' : '14-30 months',
    criminal_defense: strong ? '2-8 months for interim relief; trial risk remains separate' : '6-18 months for quashing/bail strategy',
    family: strong ? '8-18 months' : '12-36 months',
    civil_fraud: strong ? '12-24 months' : '24-48 months',
    commercial: strong ? '10-20 months' : '18-36 months',
    property: strong ? '18-36 months' : '36+ months',
    constitutional: strong ? '3-12 months' : '8-24 months',
  };
  return table[category] || '12-30 months';
}

function strategyFor(category, score, contributions, precedentMatches) {
  const negatives = contributions.filter((item) => item.impact < 0).slice(0, 2).map((item) => item.label.replaceAll('_', ' '));
  const precedentText = precedentMatches[0]?.similarity >= 55
    ? `Use ${precedentMatches[0].name} as a controlled reference, not as a guaranteed outcome.`
    : 'Do not cite a direct precedent unless counsel verifies one; the current match is below threshold.';

  if (score >= 75) {
    return `Proceed with a document-led strategy and preserve the strongest procedural record. ${precedentText}`;
  }
  if (score <= 45) {
    return `Do not overstate this matter. First cure ${negatives.join(' and ') || 'evidence/procedure gaps'} before filing or settlement positioning. ${precedentText}`;
  }
  return `Treat this as a moderate-risk matter. Improve the record on ${negatives.join(' and ') || 'evidence and procedural compliance'} before relying on aggressive relief. ${precedentText}`;
}

function riskFactors(contributions) {
  const risks = contributions
    .filter((item) => item.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .map((item) => item.reason.replace(/Detected /, ''));
  return risks.length ? risks.slice(0, 5) : ['No major structural defect detected, but pleadings and documents still require lawyer review.'];
}

export function assessLegalRisk({ caseFacts, caseType, jurisdiction, reliefSought }) {
  const text = `${caseFacts || ''} ${caseType || ''} ${jurisdiction || ''} ${reliefSought || ''}`.toLowerCase();
  const category = classifyCase(text, caseType);
  const { scores, weights, contributions, precedentMatches, finalScore } = buildScores({
    category,
    text,
    jurisdiction,
    relief: reliefSought,
  });

  const similarCases = precedentMatches.length
    ? precedentMatches.map((precedent) => ({
        name: precedent.name,
        outcome: precedent.outcome,
        similarity: precedent.similarity,
        key_takeaway: precedent.key_takeaway,
      }))
    : [{
        name: 'No strong directly relevant precedent identified',
        outcome: 'below confidence threshold',
        similarity: 0,
        key_takeaway: 'The engine avoided citation fabrication because no curated precedent crossed the match threshold.',
      }];

  return {
    success_probability: finalScore,
    confidence_level: confidence(finalScore, contributions, precedentMatches),
    verdict_prediction: verdict(finalScore),
    case_category: category,
    factors: {
      evidence_strength: { score: scores.evidence_strength, reasoning: factorReason('evidence_strength', scores.evidence_strength, category) },
      procedural_compliance: { score: scores.procedural_compliance, reasoning: factorReason('procedural_compliance', scores.procedural_compliance, category) },
      jurisdiction_advantage: { score: scores.jurisdiction_advantage, reasoning: factorReason('jurisdiction_advantage', scores.jurisdiction_advantage, category) },
      precedent_strength: { score: scores.precedent_strength, reasoning: factorReason('precedent_strength', scores.precedent_strength, category) },
      relief_likelihood: { score: scores.relief_likelihood, reasoning: factorReason('relief_likelihood', scores.relief_likelihood, category) },
      timeline_risk: { score: scores.litigation_risk, reasoning: factorReason('litigation_risk', scores.litigation_risk, category) },
    },
    score_explainability: contributions
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 10),
    scoring_model: {
      version: 'deterministic-weighted-v1',
      weights,
      note: 'Overall score is deterministic and uses weighted factors plus capped positive/negative adjustments to avoid static clustering.',
    },
    similar_cases: similarCases,
    risk_factors: riskFactors(contributions),
    recommended_strategy: strategyFor(category, finalScore, contributions, precedentMatches),
    estimated_duration: durationFor(category, finalScore),
    optimal_court: jurisdiction ? `${jurisdiction} forum, subject to territorial and subject-matter verification` : 'Jurisdiction not provided; verify territorial forum before filing',
  };
}
