export const narrativeInstructions: Record<string, string> = {
  introduction: 'Write the Introduction section: purpose of this FRS, the scheme, the directing GO and corrigenda, intended readers, and scope in two paragraphs. Cite clause IDs in square brackets, for example [GO-2].',
  asis: 'Write the As-Is process section: how applications are handled today and the problems, from the sources only, in one or two paragraphs. Cite clause IDs in square brackets.',
  tobe: 'Write the To-Be process section: the end-to-end online process from application to payment and grievance, following the workflow in MODEL, in two or three paragraphs. Cite clause IDs and workflow transition IDs in square brackets.',
};
export const NARRATIVE_SYSTEM_SUFFIX = 'Write plain prose paragraphs separated by blank lines. No headings, no lists, no markdown. Cite references in square brackets.';
