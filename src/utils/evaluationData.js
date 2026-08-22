export const STORAGE_EVALS_KEY = 'hacquire_live_evaluations_v1';

export const DEFAULT_EVALUATIONS = [];

export function getInitialEvaluations() {
  try {
    const saved = localStorage.getItem(STORAGE_EVALS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
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
