import { branding } from '@/config/branding';
import { useRepo } from '@/lib/repo/store';

/** Organisation line from Settings, printed on exported documents. */
export const orgLine = () => useRepo.getState().settings.orgLine?.trim() || `${branding.directorate}, Government of ${branding.state}`;
