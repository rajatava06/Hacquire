import { STORAGE_EVALS_KEY, DEFAULT_EVALUATIONS } from './evaluationData';

const API_ENDPOINT = '/api/evaluations';

function getLocalEvaluations() {
  try {
    const saved = localStorage.getItem(STORAGE_EVALS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed reading local evaluations:', e);
  }
  return DEFAULT_EVALUATIONS;
}

function saveLocalEvaluations(evals) {
  try {
    localStorage.setItem(STORAGE_EVALS_KEY, JSON.stringify(evals));
  } catch (e) {
    console.error('Failed saving local evaluations:', e);
  }
}

export async function fetchEvaluationsFromDB() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(API_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data) && data.length > 0) {
        saveLocalEvaluations(data);
        return data;
      }
    }
  } catch (err) {
    console.warn('Evaluations API fallback:', err.message);
  }
  return getLocalEvaluations();
}

export async function saveEvaluationToDB(evalObj) {
  const currentLocal = getLocalEvaluations();
  const updatedLocal = [...currentLocal.filter(e => e.teamId !== evalObj.teamId), evalObj];
  saveLocalEvaluations(updatedLocal);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evalObj),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchEvaluationsFromDB();
    }
  } catch (err) {
    console.error('Save evaluation API error:', err);
  }

  return updatedLocal;
}

export async function bulkSaveEvaluationsToDB(newEvalsArray) {
  const currentLocal = getLocalEvaluations();
  const map = new Map();
  currentLocal.forEach(e => map.set(e.teamId.toLowerCase(), e));
  newEvalsArray.forEach(e => map.set(e.teamId.toLowerCase(), e));
  const merged = Array.from(map.values());

  saveLocalEvaluations(merged);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvalsArray),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchEvaluationsFromDB();
    }
  } catch (err) {
    console.error('Bulk save evaluations API error:', err);
  }

  return merged;
}

export async function deleteEvaluationFromDB(teamId) {
  const currentLocal = getLocalEvaluations();
  const updatedLocal = currentLocal.filter(e => e.teamId.toLowerCase() !== teamId.toLowerCase());
  saveLocalEvaluations(updatedLocal);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${API_ENDPOINT}?teamId=${encodeURIComponent(teamId)}`, {
      method: 'DELETE',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return fetchEvaluationsFromDB();
    }
  } catch (err) {
    console.error('Delete evaluation API error:', err);
  }

  return updatedLocal;
}
