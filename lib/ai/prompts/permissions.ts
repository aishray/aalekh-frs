import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  roles: z.array(z.object({ name: z.string(), jurisdiction: z.enum(['State', 'District', 'Institution', 'Self']), admin: z.boolean() })),
  actions: z.array(z.string()),
  grants: z.array(z.object({ role: z.string(), actions: z.array(z.string()) })),
});
export const permissions: PromptDef<z.infer<typeof schema>> = {
  task: 'permissions',
  name: 'permissions',
  schema,
  instruction: `Propose a role-permission matrix. Roles come from MODEL (discovery roles and workflow actors, excluding System). Actions are every workflow action plus View, Export and Configure masters. Give each role a jurisdiction scope. Apply maker-checker: no role both verifies and sanctions. Administrators configure masters but do not act on applications.`,
};
