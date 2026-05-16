const CITY_TO_STATE = {
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  mysuru: 'Karnataka',
  mysore: 'Karnataka',
  chennai: 'Tamil Nadu',
  madras: 'Tamil Nadu',
  coimbatore: 'Tamil Nadu',
  mumbai: 'Maharashtra',
  bombay: 'Maharashtra',
  pune: 'Maharashtra',
  nagpur: 'Maharashtra',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  kolkata: 'West Bengal',
  calcutta: 'West Bengal',
  jaipur: 'Rajasthan',
  jodhpur: 'Rajasthan',
  ahmedabad: 'Gujarat',
  surat: 'Gujarat',
  kochi: 'Kerala',
  cochin: 'Kerala',
  ernakulam: 'Kerala',
  lucknow: 'Uttar Pradesh',
  prayagraj: 'Uttar Pradesh',
  allahabad: 'Uttar Pradesh',
  chandigarh: 'Punjab',
  gurugram: 'Haryana',
  gurgaon: 'Haryana',
  noida: 'Uttar Pradesh',
  hyderabad: 'Telangana',
  secunderabad: 'Telangana',
};

const STATE_TO_COURT = {
  Delhi: 'Delhi High Court',
  Karnataka: 'Karnataka High Court',
  'Tamil Nadu': 'Madras High Court',
  Maharashtra: 'Bombay High Court',
  'West Bengal': 'Calcutta High Court',
  Rajasthan: 'Rajasthan High Court',
  Gujarat: 'Gujarat High Court',
  Kerala: 'Kerala High Court',
  'Uttar Pradesh': 'Allahabad High Court',
  Punjab: 'Punjab & Haryana HC',
  Haryana: 'Punjab & Haryana HC',
  Telangana: 'Telangana High Court',
};

const CASE_POLICIES = {
  family: {
    domain: 'Family',
    weights: { procedural: 0.34, geography: 0.34, specialization: 0.14, velocity: 0.08, injunction: 0.03, pendency: 0.07 },
    rule: 'Family and custody matters should usually prioritize petitioner convenience, child welfare, territorial connection, and practical access to the local Family Court over generic speed metrics.',
  },
  cheque_bounce: {
    domain: 'Commercial',
    weights: { procedural: 0.42, geography: 0.26, specialization: 0.08, velocity: 0.08, injunction: 0.02, pendency: 0.14 },
    rule: 'For Section 138 NI Act matters, Section 142(2) makes bank-branch location central: collection through an account points to the payee account branch; direct presentation points to the drawee bank branch.',
  },
  criminal: {
    domain: 'Criminal',
    weights: { procedural: 0.38, geography: 0.28, specialization: 0.12, velocity: 0.08, injunction: 0.02, pendency: 0.12 },
    rule: 'Criminal matters should prioritize FIR location, place of offence, investigation forum, and territorial procedural validity.',
  },
  labour: {
    domain: 'Labour',
    weights: { procedural: 0.34, geography: 0.30, specialization: 0.12, velocity: 0.07, injunction: 0.02, pendency: 0.15 },
    rule: 'Labour matters should prioritize workplace connection, employee convenience, and practical labour forum access before speed metrics.',
  },
  ip: {
    domain: 'IP',
    weights: { procedural: 0.18, geography: 0.18, specialization: 0.22, velocity: 0.14, injunction: 0.22, pendency: 0.06 },
    rule: 'IP and trademark matters can weigh interim relief and specialist commercial/IP benches more heavily, while still respecting territorial cause-of-action facts.',
  },
  commercial: {
    domain: 'Commercial',
    weights: { procedural: 0.22, geography: 0.18, specialization: 0.18, velocity: 0.20, injunction: 0.08, pendency: 0.14 },
    rule: 'Commercial disputes can weigh court infrastructure, disposal speed, and commercial bench experience after valid territorial anchors are identified.',
  },
  constitutional: {
    domain: 'Constitutional',
    weights: { procedural: 0.28, geography: 0.20, specialization: 0.18, velocity: 0.12, injunction: 0.10, pendency: 0.12 },
    rule: 'Constitutional and writ matters should prioritize the state action or authority location, affected petitioner location, and High Court writ jurisdiction.',
  },
  civil: {
    domain: 'Civil',
    weights: { procedural: 0.30, geography: 0.26, specialization: 0.12, velocity: 0.10, injunction: 0.08, pendency: 0.14 },
    rule: 'Civil disputes should prioritize cause of action, property or defendant location, and procedural maintainability before court-speed comparison.',
  },
};

const CITY_PATTERN = new RegExp(`\\b(${Object.keys(CITY_TO_STATE).sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

function normalizeMetric(value) {
  const numeric = Number(value) || 0;
  return numeric <= 1 ? numeric * 100 : numeric;
}

function stableRound(value) {
  return Math.round(value * 10) / 10;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function classifyCase(summary) {
  const text = summary.toLowerCase();
  if (/\b(divorce|custody|child custody|maintenance|matrimonial|spouse|wife|husband|domestic violence|emotional abuse|financial abandonment)\b/.test(text)) return 'family';
  if (/\b(cheque|check|dishonou?r|bounce|section 138|138 ni|ni act|negotiable instruments?|payee bank|drawer bank|drawee bank)\b/.test(text)) return 'cheque_bounce';
  if (/\b(fir|bail|charge.?sheet|police|accused|complainant|offence|criminal|arrest|investigation)\b/.test(text)) return 'criminal';
  if (/\b(employee|employer|termination|retrenchment|wages|salary|industrial dispute|labou?r|workman|factory)\b/.test(text)) return 'labour';
  if (/\b(trademark|trade mark|copyright|patent|passing off|infringement|design piracy|brand)\b/.test(text)) return 'ip';
  if (/\b(writ|constitutional|article 226|state action|government authority|public authority|fundamental right)\b/.test(text)) return 'constitutional';
  if (/\b(contract|shareholder|company|corporate|arbitration|commercial|invoice|specific performance|insolvency)\b/.test(text)) return 'commercial';
  return 'civil';
}

function detectUrgency(summary) {
  const text = summary.toLowerCase();
  if (/\b(urgent|interim|injunction|stay|custody|arrest|eviction|freeze|restrain|immediate)\b/.test(text)) return 'high';
  if (/\b(delay|pending|notice|summons|hearing)\b/.test(text)) return 'medium';
  return 'medium';
}

function extractLocations(summary, clientState) {
  const matches = [...summary.matchAll(CITY_PATTERN)];
  const lowered = summary.toLowerCase();
  const locations = matches.map((match) => ({
    city: match[0],
    state: CITY_TO_STATE[match[0].toLowerCase()],
    index: match.index ?? 0,
  }));

  const stateNear = (keywords) => {
    for (const location of locations) {
      const window = lowered.slice(Math.max(0, location.index - 90), Math.min(lowered.length, location.index + location.city.length + 90));
      if (keywords.some((keyword) => window.includes(keyword))) return location.state;
    }
    return null;
  };

  const stateAfter = (keywords) => {
    let best = null;
    for (const keyword of keywords) {
      let from = 0;
      while (from < lowered.length) {
        const keywordIndex = lowered.indexOf(keyword, from);
        if (keywordIndex === -1) break;
        for (const location of locations) {
          const distance = location.index - keywordIndex;
          if (distance >= 0 && distance <= 110 && (!best || distance < best.distance)) {
            best = { state: location.state, distance };
          }
        }
        from = keywordIndex + keyword.length;
      }
    }
    return best?.state || null;
  };

  return {
    all_states: unique([clientState, ...locations.map((loc) => loc.state)]),
    petitioner_state:
      stateAfter(['woman', 'wife', 'husband', 'petitioner', 'plaintiff', 'complainant', 'payee', 'employee', 'worker', 'brand owner', 'supplier']) ||
      stateNear(['woman', 'wife', 'husband', 'petitioner', 'plaintiff', 'complainant', 'payee', 'employee', 'worker', 'brand owner', 'supplier']) ||
      clientState ||
      locations[0]?.state ||
      null,
    respondent_state:
      stateAfter(['spouse', 'respondent', 'defendant', 'accused', 'drawer', 'employer', 'seller']) ||
      locations[1]?.state ||
      null,
    fir_state: stateAfter(['fir', 'offence', 'incident', 'crime', 'police station', 'registered']),
    transaction_state: stateAfter(['transaction', 'contract', 'invoice', 'agreement', 'cause of action', 'goods supplied', 'services rendered']),
    workplace_state: stateAfter(['worked', 'working', 'workplace', 'factory', 'office', 'employment', 'posted', 'terminated']) || stateNear(['employee', 'worker']),
    payee_bank_state: stateAfter(['payee bank', "payee's bank", 'home branch', 'account branch', 'collection branch']),
    drawee_bank_state: stateAfter(['drawee bank', 'drawer bank', "drawer's bank"]),
    raw_locations: locations,
  };
}

function normalizeCourts(courts) {
  const byName = new Map();
  for (const court of courts || []) {
    if (!court?.court_name) continue;
    const existing = byName.get(court.court_name);
    const normalized = {
      court_name: court.court_name,
      state: court.state,
      domain: court.domain || 'Civil',
      velocity_score: normalizeMetric(court.velocity_score),
      injunction_rate: normalizeMetric(court.injunction_rate),
      pendency_days: Number(court.pendency_days) || 600,
    };
    if (!existing || normalized.velocity_score + normalized.injunction_rate > existing.velocity_score + existing.injunction_rate) {
      byName.set(court.court_name, normalized);
    }
  }
  return [...byName.values()];
}

function fallbackCourtForState(state) {
  const courtName = STATE_TO_COURT[state];
  if (!courtName) return null;
  return {
    court_name: courtName,
    state,
    domain: 'Civil',
    velocity_score: 58,
    injunction_rate: 45,
    pendency_days: 620,
  };
}

function statesForCase(caseType, signals) {
  switch (caseType) {
    case 'family':
      return unique([signals.petitioner_state, signals.respondent_state]);
    case 'cheque_bounce':
      if (signals.payee_bank_state) return [signals.payee_bank_state];
      if (signals.drawee_bank_state && /direct|otherwise through an account/i.test(signals.summary || '')) return [signals.drawee_bank_state];
      return unique([signals.petitioner_state, signals.transaction_state, signals.respondent_state]);
    case 'criminal':
      if (signals.fir_state) return [signals.fir_state];
      return unique([signals.fir_state, signals.transaction_state, signals.petitioner_state, signals.respondent_state]);
    case 'labour':
      return unique([signals.workplace_state, signals.petitioner_state, signals.respondent_state]);
    case 'ip':
    case 'commercial':
    case 'constitutional':
    case 'civil':
    default:
      return unique([signals.transaction_state, signals.petitioner_state, signals.respondent_state]);
  }
}

function proceduralFit(caseType, court, signals, allowedStates) {
  if (allowedStates.includes(court.state)) {
    if (caseType === 'family' && court.state === signals.petitioner_state) return 96;
    if (caseType === 'cheque_bounce' && court.state === signals.payee_bank_state) return 98;
    if (caseType === 'criminal' && court.state === signals.fir_state) return 96;
    if (caseType === 'labour' && court.state === signals.workplace_state) return 92;
    return 84;
  }
  return 20;
}

function geographyFit(caseType, court, signals) {
  if (court.state === signals.petitioner_state) return caseType === 'family' || caseType === 'labour' ? 96 : 82;
  if (court.state === signals.respondent_state) return caseType === 'family' ? 78 : 76;
  if (court.state === signals.transaction_state || court.state === signals.fir_state || court.state === signals.workplace_state) return 88;
  return 30;
}

function specializationFit(caseType, court, policyDomain) {
  if (caseType === 'family') return court.state ? 72 : 50;
  if (caseType === 'cheque_bounce') return court.domain === 'Commercial' || court.domain === 'Civil' ? 78 : 62;
  if (court.domain === policyDomain) return 92;
  if (caseType === 'commercial' && ['Technology', 'IP'].includes(court.domain)) return 76;
  if (caseType === 'ip' && ['Commercial', 'Technology'].includes(court.domain)) return 78;
  return 58;
}

function pendencyFit(days) {
  const capped = Math.min(Math.max(days, 180), 900);
  return 100 - ((capped - 180) / 720) * 70;
}

function buildReasons(caseType, court, signals, scoreParts) {
  const reasons = [];
  const risks = [];

  if (court.state === signals.petitioner_state) {
    reasons.push(caseType === 'family'
      ? 'Strong petitioner-convenience connection; local family proceedings are more practical for residence, child welfare, and follow-up hearings.'
      : 'Strong territorial connection to the initiating party.');
  }
  if (court.state === signals.respondent_state) {
    reasons.push('Respondent-side territorial connection is present, reducing maintainability risk.');
  }
  if (court.state === signals.payee_bank_state) {
    reasons.push('Matches the payee bank branch anchor relevant to Section 142(2)(a) NI Act jurisdiction.');
  }
  if (court.state === signals.fir_state) {
    reasons.push('Matches the FIR/offence location, which is the strongest criminal procedure anchor.');
  }
  if (court.state === signals.workplace_state) {
    reasons.push('Matches the workplace/employment forum, supporting practical labour dispute handling.');
  }
  if (scoreParts.velocity >= 70 && ['commercial', 'ip'].includes(caseType)) {
    reasons.push('Operational metrics indicate stronger disposal velocity for a business-sensitive matter.');
  }
  if (scoreParts.injunction >= 65 && caseType === 'ip') {
    reasons.push('Interim relief profile is useful for trademark/IP matters where early restraint can matter.');
  }

  if (court.state !== signals.petitioner_state && ['family', 'labour'].includes(caseType)) {
    risks.push('Travel burden and access-to-forum concerns should be reviewed before filing.');
  }
  if (caseType === 'family') {
    risks.push('High Court metrics are only a supervisory signal; the immediate forum may be the competent Family Court.');
  }
  if (caseType === 'cheque_bounce' && !signals.payee_bank_state) {
    risks.push('Confirm payee home branch and mode of cheque presentation before final filing.');
  }
  if (scoreParts.procedural < 90) {
    risks.push('Procedural facts should be verified before treating this as the filing forum.');
  }

  return {
    pros: unique(reasons).slice(0, 4),
    cons: unique(risks).slice(0, 3),
  };
}

function rejectionReason(caseType, court, allowedStates, signals) {
  if (!allowedStates.length) return 'No hard rejection because territorial facts are incomplete.';
  if (caseType === 'family') {
    return `Rejected: no clear petitioner, respondent, child-welfare, or family-court territorial anchor in ${court.state}.`;
  }
  if (caseType === 'cheque_bounce') {
    return signals.payee_bank_state
      ? `Rejected: Section 138/142(2) analysis points to the payee bank branch state, not ${court.state}.`
      : `Rejected: no bank-branch or transaction anchor found in ${court.state}.`;
  }
  if (caseType === 'criminal') {
    return `Rejected: no FIR, offence-location, or investigation anchor found in ${court.state}.`;
  }
  if (caseType === 'labour') {
    return `Rejected: no workplace, employee, or employer territorial anchor found in ${court.state}.`;
  }
  return `Rejected: no pleaded cause-of-action or party-location anchor found in ${court.state}.`;
}

function confidenceFor(caseType, allowedStates, signals) {
  const hasStrongAnchor =
    (caseType === 'family' && !!signals.petitioner_state && !!signals.respondent_state) ||
    (caseType === 'cheque_bounce' && !!signals.payee_bank_state) ||
    (caseType === 'criminal' && !!signals.fir_state) ||
    (caseType === 'labour' && (!!signals.workplace_state || !!signals.petitioner_state)) ||
    (allowedStates.length > 0);

  if (!hasStrongAnchor) {
    return {
      level: 'low',
      range: '35-55',
      explanation: 'Key territorial facts are missing, so the engine avoids a strong recommendation.',
    };
  }
  if (['family', 'cheque_bounce', 'criminal', 'labour'].includes(caseType) && allowedStates.length <= 2) {
    return {
      level: 'high',
      range: '70-85',
      explanation: 'Case type and territorial anchors are clear enough for a narrow candidate set.',
    };
  }
  return {
    level: 'moderate',
    range: '55-70',
    explanation: 'There are usable territorial anchors, but multiple filing theories may need lawyer review.',
  };
}

function buildOverallStrategy(caseType, recommendations, confidence) {
  const top = recommendations[0];
  if (!top) {
    return 'Insufficient territorial facts. Ask for petitioner/respondent location, cause of action, and forum-specific facts before recommending a court.';
  }
  if (caseType === 'family') {
    return `Treat ${top.court_name} as the leading jurisdictional signal because local residence and family-court practicality outweigh generic speed metrics. Verify the competent Family Court and any child-custody residence facts before filing.`;
  }
  if (caseType === 'cheque_bounce') {
    return `Treat ${top.court_name} as the leading forum only if the bank-branch facts support it. Under Section 142(2), account-collection cases turn on the payee account branch, while direct presentation may point to the drawee bank branch.`;
  }
  if (confidence.level === 'low') {
    return `Use ${top.court_name} only as a provisional lead. The matter needs stronger location facts before a filing strategy is defensible.`;
  }
  return `Use ${top.court_name} as the leading candidate, but validate cause of action, party location, and any statutory forum rules before treating the ranking as a filing decision.`;
}

export function analyzeJurisdiction({ caseSummary, clientState, courts }) {
  const caseType = classifyCase(caseSummary);
  const policy = CASE_POLICIES[caseType] || CASE_POLICIES.civil;
  const signals = { ...extractLocations(caseSummary, clientState), summary: caseSummary };
  const allowedStates = statesForCase(caseType, signals);
  const normalizedCourts = normalizeCourts(courts);

  for (const state of allowedStates) {
    const courtName = STATE_TO_COURT[state];
    if (courtName && !normalizedCourts.some((court) => court.court_name === courtName)) {
      const fallback = fallbackCourtForState(state);
      if (fallback) normalizedCourts.push(fallback);
    }
  }

  const hasHardFilter = allowedStates.length > 0;
  const candidates = hasHardFilter
    ? normalizedCourts.filter((court) => allowedStates.includes(court.state))
    : normalizedCourts;

  const rejectedCourts = normalizedCourts
    .filter((court) => !candidates.some((candidate) => candidate.court_name === court.court_name))
    .map((court) => ({
      court_name: court.court_name,
      state: court.state,
      reason: rejectionReason(caseType, court, allowedStates, signals),
    }));

  const rankedCourts = candidates
    .map((court) => {
      const scoreParts = {
        procedural: proceduralFit(caseType, court, signals, allowedStates),
        geography: geographyFit(caseType, court, signals),
        specialization: specializationFit(caseType, court, policy.domain),
        velocity: court.velocity_score,
        injunction: court.injunction_rate,
        pendency: pendencyFit(court.pendency_days),
      };
      const weights = policy.weights;
      const viabilityScore = stableRound(
        scoreParts.procedural * weights.procedural +
        scoreParts.geography * weights.geography +
        scoreParts.specialization * weights.specialization +
        scoreParts.velocity * weights.velocity +
        scoreParts.injunction * weights.injunction +
        scoreParts.pendency * weights.pendency
      );
      const explanationParts = buildReasons(caseType, court, signals, scoreParts);

      return {
        ...court,
        domain: policy.domain,
        viability_score: viabilityScore,
        is_local: court.state === signals.petitioner_state || court.state === clientState,
        distance_penalty: court.state === signals.petitioner_state ? 0 : 0.2,
        score_components: scoreParts,
        pros: explanationParts.pros,
        cons: explanationParts.cons,
      };
    })
    .sort((a, b) => b.viability_score - a.viability_score || a.pendency_days - b.pendency_days);

  const confidence = confidenceFor(caseType, allowedStates, signals);

  const recommendations = rankedCourts.slice(0, 3).map((court, index) => ({
    court_name: court.court_name,
    state: court.state,
    rank: index + 1,
    reasoning: `${court.court_name} is recommended because it fits the ${policy.domain.toLowerCase()} procedural theory and has a defensible territorial connection to ${court.state}. ${court.pros[0] || policy.rule}`,
    pros: court.pros.length ? court.pros : [policy.rule],
    cons: court.cons,
    estimated_timeline: `${Math.max(6, Math.round(court.pendency_days / 45))}-${Math.max(9, Math.round(court.pendency_days / 30))} months, subject to forum and bench assignment`,
  }));

  return {
    classification: {
      domain: policy.domain,
      case_type: caseType,
      urgency: detectUrgency(caseSummary),
      jurisdiction_notes: policy.rule,
    },
    extracted_entities: {
      locations: signals.raw_locations,
      petitioner_state: signals.petitioner_state,
      respondent_state: signals.respondent_state,
      transaction_state: signals.transaction_state,
      fir_state: signals.fir_state,
      workplace_state: signals.workplace_state,
      payee_bank_state: signals.payee_bank_state,
      drawee_bank_state: signals.drawee_bank_state,
    },
    reasoning_trace: {
      pipeline: [
        'case_classifier',
        'entity_extraction',
        'hard_jurisdiction_filter',
        'case_type_policy_engine',
        'weighted_scoring_engine',
        'explainability_engine',
      ],
      allowed_states: allowedStates,
      hard_filter_applied: hasHardFilter,
      policy_weights: policy.weights,
      policy_rule: policy.rule,
    },
    confidence,
    ranked_courts: rankedCourts,
    recommendations,
    rejected_courts: rejectedCourts,
    overall_strategy: buildOverallStrategy(caseType, recommendations, confidence),
  };
}

export const DEFAULT_COURTS = [
  { court_name: 'Delhi High Court', state: 'Delhi', velocity_score: 82, injunction_rate: 71, pendency_days: 340, domain: 'Constitutional' },
  { court_name: 'Bombay High Court', state: 'Maharashtra', velocity_score: 78, injunction_rate: 68, pendency_days: 410, domain: 'Commercial' },
  { court_name: 'Madras High Court', state: 'Tamil Nadu', velocity_score: 65, injunction_rate: 55, pendency_days: 520, domain: 'IP' },
  { court_name: 'Karnataka High Court', state: 'Karnataka', velocity_score: 75, injunction_rate: 62, pendency_days: 380, domain: 'Technology' },
  { court_name: 'Calcutta High Court', state: 'West Bengal', velocity_score: 58, injunction_rate: 45, pendency_days: 650, domain: 'Civil' },
  { court_name: 'Allahabad High Court', state: 'Uttar Pradesh', velocity_score: 42, injunction_rate: 38, pendency_days: 890, domain: 'Criminal' },
  { court_name: 'Gujarat High Court', state: 'Gujarat', velocity_score: 71, injunction_rate: 60, pendency_days: 420, domain: 'Commercial' },
  { court_name: 'Rajasthan High Court', state: 'Rajasthan', velocity_score: 55, injunction_rate: 42, pendency_days: 580, domain: 'Civil' },
  { court_name: 'Punjab & Haryana HC', state: 'Punjab', velocity_score: 63, injunction_rate: 52, pendency_days: 490, domain: 'Criminal' },
  { court_name: 'Kerala High Court', state: 'Kerala', velocity_score: 72, injunction_rate: 64, pendency_days: 370, domain: 'Constitutional' },
];
