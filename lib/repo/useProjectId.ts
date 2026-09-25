'use client';

import { useParams } from 'next/navigation';
import { useRepo } from './store';

/** For pages inside /projects/[id]: the layout guarantees hydration and existence. */
export function useCurrentProject() {
  const { id } = useParams<{ id: string }>();
  const project = useRepo((s) => s.projects.find((p) => p.id === id))!;
  const update = useRepo((s) => s.update);
  return { project, update: (action: string, target: string | undefined, fn: Parameters<typeof update>[3]) => update(id, action, target, fn) };
}
