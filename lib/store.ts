import "server-only";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR, readJson } from "./data";
import type { Patient } from "./types";

/**
 * Demo store. Reads data/demo_patients.json and keeps edits in a JSON overlay file.
 * Locally the overlay is data/state.json (git-ignored).
 * On Vercel the project folder is read-only, so the overlay goes to /tmp: edits survive
 * while that server instance is warm, then reset to the demo data. Fine for a demo.
 */
const STATE_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "genomed-state.json")
  : path.join(DATA_DIR, "state.json");

type State = Record<string, Patient>;

function load(): State {
  const base = readJson<{ patients: Patient[] }>("demo_patients.json").patients;
  const state: State = Object.fromEntries(base.map((p) => [p.id, structuredClone(p)]));
  if (existsSync(STATE_FILE)) {
    try {
      Object.assign(state, JSON.parse(readFileSync(STATE_FILE, "utf-8")) as State);
    } catch {
      /* corrupt overlay: fall back to demo data */
    }
  }
  return state;
}

function save(state: State) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export const listPatients = (): Patient[] => Object.values(load());
export const getPatient = (id: string): Patient | null => load()[id] ?? null;

export function updatePatient(id: string, change: (p: Patient) => void): Patient | null {
  const state = load();
  const p = state[id];
  if (!p) return null;
  change(p);
  save(state);
  return p;
}

export function resetDemo() {
  save({});
}

/** Public emergency page lookup. Only enabled cards with a matching token are found. */
export function getEmergencyCard(token: string) {
  if (!token) return null;
  const p = listPatients().find((x) => x.emergency?.enabled && x.emergency.token === token);
  return p?.emergency ?? null;
}

/** Bracelet short link: /B/<CODE> -> the card's full emergency page. */
export function getEmergencyByShortCode(code: string) {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  return listPatients().find((x) => x.emergency?.enabled && x.emergency.short_code === c)?.emergency ?? null;
}
