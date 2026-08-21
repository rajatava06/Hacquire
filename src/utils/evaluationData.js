export const STORAGE_EVALS_KEY = 'hacquire_live_evaluations_v1';

export const DEFAULT_EVALUATIONS = [
  {
    teamId: 'T-01',
    teamName: 'CodeCrafters',
    problemStatement: "PS8: The Shopkeeper's Day",
    dealsExecuted: 2,
    dealStatus: 'QUALIFIED',
    strategicRationale: 13.5,
    valuationPricing: 9.0,
    integrationQuality: 14.0,
    totalScore: 36.5,
    feedback: 'Acquired route engine; great synergy and live working demo.'
  },
  {
    teamId: 'T-02',
    teamName: 'ByteBrigade',
    problemStatement: 'PS9: Getting Paid',
    dealsExecuted: 1,
    dealStatus: 'QUALIFIED',
    strategicRationale: 12.0,
    valuationPricing: 8.0,
    integrationQuality: 13.0,
    totalScore: 33.0,
    feedback: 'Bought OCR module, clean WhatsApp payment integration.'
  },
  {
    teamId: 'T-03',
    teamName: 'HyperLog',
    problemStatement: 'PS1: Smart Campus Emergency Response',
    dealsExecuted: 3,
    dealStatus: 'QUALIFIED',
    strategicRationale: 14.0,
    valuationPricing: 9.5,
    integrationQuality: 14.5,
    totalScore: 38.0,
    feedback: 'Aggressive buyer, integrated 2 modules and 1 consulting slot seamlessly.'
  },
  {
    teamId: 'T-04',
    teamName: 'MandiTech',
    problemStatement: 'PS4: Farmer-to-Market Decision Platform',
    dealsExecuted: 1,
    dealStatus: 'QUALIFIED',
    strategicRationale: 11.0,
    valuationPricing: 7.5,
    integrationQuality: 12.0,
    totalScore: 30.5,
    feedback: 'Merged with T-08; solid price discovery pipeline.'
  },
  {
    teamId: 'T-05',
    teamName: 'SevaSetu',
    problemStatement: 'PS10: Paperwork & Access',
    dealsExecuted: 0,
    dealStatus: 'NO DEALS - INELIGIBLE',
    strategicRationale: 0,
    valuationPricing: 0,
    integrationQuality: 0,
    totalScore: 0,
    feedback: 'Did not execute any trade; 0 dealmaking points as per mandatory rule.'
  }
];

export function getInitialEvaluations() {
  try {
    const saved = localStorage.getItem(STORAGE_EVALS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse localStorage evaluations', e);
  }
  return DEFAULT_EVALUATIONS;
}

export function saveEvaluationsToStorage(evals) {
  try {
    localStorage.setItem(STORAGE_EVALS_KEY, JSON.stringify(evals));
  } catch (e) {
    console.error('Failed to save evaluations to localStorage', e);
  }
}
