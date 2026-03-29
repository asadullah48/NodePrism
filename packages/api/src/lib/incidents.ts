export type IncidentAction = 'open' | 'close' | 'noop';

export function resolveIncidentAction(
  success: boolean,
  openIncidentId: string | null
): IncidentAction {
  if (!success && openIncidentId === null) return 'open';
  if (success && openIncidentId !== null) return 'close';
  return 'noop';
}
