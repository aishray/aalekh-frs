import type { Project } from '@/lib/types';
import type { Tone } from '@/components/ui';

export function statusTone(s: Project['status']): Tone {
  return s === 'Approved' ? 'ok' : s === 'In review' ? 'navy' : s === 'Changes requested' ? 'warn' : 'neutral';
}
