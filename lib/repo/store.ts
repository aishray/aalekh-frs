'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ActivityEvent, PersonaId, Project } from '@/lib/types';
import { personas } from '@/config/branding';
import { nowIso, uid } from '@/lib/util';
import { buildSeed, SEED_VERSION } from '@/lib/seed';
import { buildScholarshipProject } from '@/lib/seed/scholarship';

import type { ReferenceOverrides } from '@/lib/engine/reference';
import { TASKS, type AiTask, type Reasoning } from '@/lib/ai/models';
export type { AiTask };

export type Settings = {
  recorded: boolean;
  /** Per-task reasoning override; the model per task is fixed in lib/ai/models.ts. */
  reasoning: Record<AiTask, Reasoning>;
  orgLine: string;
  /** Edits made on the Standards page; defaults ship in data/*.json. */
  reference?: ReferenceOverrides;
};

export const defaultReasoning = Object.fromEntries(Object.entries(TASKS).map(([k, v]) => [k, v.reasoning])) as Settings['reasoning'];

type State = {
  seedVersion: number;
  projects: Project[];
  activity: ActivityEvent[];
  persona: PersonaId;
  settings: Settings;
};

type Actions = {
  /** Every project mutation goes through here and appends an activity event. */
  update: (projectId: string, action: string, target: string | undefined, fn: (p: Project) => void) => void;
  addProject: (p: Project) => void;
  log: (action: string, target?: string, projectId?: string) => void;
  setPersona: (id: PersonaId) => void;
  setSettings: (s: Partial<Settings>) => void;
  resetSample: () => void;
  resetAll: () => void;
};

const initial = (): State => {
  const seed = buildSeed();
  return {
    seedVersion: SEED_VERSION,
    projects: seed.projects,
    activity: seed.activity,
    persona: 'author',
    settings: { recorded: true, reasoning: { ...defaultReasoning }, orgLine: 'Directorate of Information Technology, Government of Rajyapradesh' },
  };
};

export const useRepo = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial(),
      update: (projectId, action, target, fn) => {
        const persona = personas.find((p) => p.id === get().persona)!;
        set((s) => {
          const idx = s.projects.findIndex((p) => p.id === projectId);
          if (idx < 0) return s;
          const next = structuredClone(s.projects[idx]);
          fn(next);
          next.updatedAt = nowIso();
          const projects = s.projects.slice();
          projects[idx] = next;
          const ev: ActivityEvent = { id: uid('ev'), at: nowIso(), user: persona.name, projectId, projectName: next.name, action, target };
          return { projects, activity: [ev, ...s.activity].slice(0, 800) };
        });
      },
      addProject: (p) => {
        const persona = personas.find((x) => x.id === get().persona)!;
        set((s) => ({
          projects: [p, ...s.projects],
          activity: [{ id: uid('ev'), at: nowIso(), user: persona.name, projectId: p.id, projectName: p.name, action: 'Created project', target: p.fileNo }, ...s.activity],
        }));
      },
      log: (action, target, projectId) => {
        const persona = personas.find((x) => x.id === get().persona)!;
        const projectName = projectId ? get().projects.find((p) => p.id === projectId)?.name : undefined;
        set((s) => ({ activity: [{ id: uid('ev'), at: nowIso(), user: persona.name, projectId, projectName, action, target }, ...s.activity].slice(0, 800) }));
      },
      setPersona: (id) => set({ persona: id }),
      setSettings: (x) => set((s) => ({ settings: { ...s.settings, ...x } })),
      resetSample: () => {
        const fresh = buildScholarshipProject();
        const persona = personas.find((x) => x.id === get().persona)!;
        set((s) => ({
          projects: s.projects.map((p) => (p.sample === 'scholarship' ? fresh : p)),
          activity: [{ id: uid('ev'), at: nowIso(), user: persona.name, projectId: fresh.id, projectName: fresh.name, action: 'Reset sample project' }, ...s.activity],
        }));
      },
      resetAll: () => set(initial()),
    }),
    {
      name: 'aalekh-frs',
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: () => initial() as State & Actions,
      partialize: (s) => ({ seedVersion: s.seedVersion, projects: s.projects, activity: s.activity, persona: s.persona, settings: s.settings }),
    },
  ),
);

export function useProject(id: string) {
  return useRepo((s) => s.projects.find((p) => p.id === id));
}

export function usePersona() {
  const id = useRepo((s) => s.persona);
  return personas.find((p) => p.id === id)!;
}
