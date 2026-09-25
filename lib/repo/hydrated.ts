'use client';

import { useEffect, useState } from 'react';
import { useRepo } from './store';

/** True once the persisted store has rehydrated on the client. Pages render skeletons until then. */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (useRepo.persist.hasHydrated()) setOk(true);
    const unsub = useRepo.persist.onFinishHydration(() => setOk(true));
    return unsub;
  }, []);
  return ok;
}
