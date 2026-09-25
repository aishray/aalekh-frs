import type { PromptDef } from './base';
import { classify } from './classify';
import { segment } from './segment';
import { reconcile } from './reconcile';
import { discovery } from './discovery';
import { questions } from './questions';
import { workflow } from './workflow';
import { fields } from './fields';
import { rules } from './rules';
import { permissions } from './permissions';
import { requirements } from './requirements';
import { review } from './review';
import { fix } from './fix';
import { impact } from './impact';
import { cr } from './cr';
import { interview } from './interview';

export const prompts: Record<string, PromptDef<unknown>> = {
  classify, segment, reconcile, discovery, questions, workflow, fields, rules, permissions, requirements, review, fix, impact, cr, interview,
} as Record<string, PromptDef<unknown>>;

export type Step = keyof typeof prompts;
