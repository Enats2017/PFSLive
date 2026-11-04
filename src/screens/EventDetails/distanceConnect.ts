/**
 * Whether a distance card offers its connect / register button. Pure - tested in
 * distanceConnect.test.ts (npm run test:distance-connect).
 *
 * The API sets registration_closed on a distance that is only a results list
 * (GT80 BC next to GT80). Its status alone cannot decide this: 'unavailable' also
 * means an event that is not configured yet, where the card keeps its button.
 * A runner already registered there keeps it too, as that is how they undo.
 */
type ConnectItem = {
  registration_closed?: number;
  registration_status?: string;
};

export function canShowConnectButton(item: ConnectItem): boolean {
  return item.registration_closed !== 1 || item.registration_status === 'registered';
}
