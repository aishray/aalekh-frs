import { z } from 'zod';
import { refs, type PromptDef } from './base';

const schema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    fields: z.array(z.object({
      label: z.string(),
      labelOriginal: z.string().nullable(),
      name: z.string(),
      type: z.enum(['String', 'Number', 'Date', 'Enum', 'Boolean', 'File']),
      length: z.number().nullable(),
      mandatory: z.boolean(),
      validation: z.string().nullable(),
      valueSource: z.enum(['Applicant', 'Aadhaar eKYC', 'DigiLocker', 'Master', 'System']),
      masterList: z.string().nullable(),
      pii: z.enum(['Personal', 'Sensitive', 'Aadhaar', 'Financial', 'None']),
      refs,
    })),
  })),
  masters: z.array(z.object({ name: z.string(), values: z.array(z.string()), owner: z.string() })),
});
export const fields: PromptDef<z.infer<typeof schema>> = {
  task: 'fields',
  name: 'data_dictionary',
  schema,
  maxTokens: 7000,
  instruction: `Build the data dictionary from the digitised form (FORM clauses) and the sources. For each field give: English label, original label if not English, camelCase field name, data type, length, mandatory, validation rule, source of value (Aadhaar eKYC for identity fields where e-KYC is mandated, DigiLocker for certificates available there, Master for lists), master list name, PII classification (Aadhaar for the Aadhaar number, Sensitive for caste or health, Financial for income and bank details, Personal for other personal data), and refs (FORM clause plus any rule clause). List master lists with known values and owning office.`,
};
