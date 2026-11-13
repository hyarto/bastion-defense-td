import { defaultSave, type Save } from "./data";

const KEY = "bastion-defense-save-v1";

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const d = defaultSave();
    return {
      ...d,
      ...parsed,
      skills: { ...d.skills, ...(parsed.skills ?? {}) },
      upgrades: { ...(parsed.upgrades ?? {}) },
      stars: { ...(parsed.stars ?? {}) },
      owned: Array.isArray(parsed.owned) && parsed.owned.length ? parsed.owned : d.owned,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
