// Stroke icons (paths from the prototype).
const ICONS = {
  overview: '<path d="M3 11 L12 4 L21 11"/><path d="M5 10 V20 H19 V10"/><path d="M10 20 V14 H14 V20"/>',
  delivery: '<path d="M2 6 H14 V16 H2 Z"/><path d="M14 9 H18 L22 13 V16 H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20 C2.5 15.5 5.5 13.5 9 13.5 C12.5 13.5 15.5 15.5 15.5 20"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 13.8 C19.8 14 21.5 15.8 21.5 19"/>',
  risk: '<path d="M12 3.5 L21.5 20 H2.5 Z"/><path d="M12 10 V14"/><path d="M12 17 V17.2"/>',
  forecast: '<path d="M3 17 L9 10 L13 14 L21 5"/><path d="M15 5 H21 V11"/>',
  quality: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z"/><path d="M8.5 12 L11 14.5 L15.5 9.5"/>',
  reports: '<path d="M6 3 H14 L19 8 V21 H6 Z"/><path d="M14 3 V8 H19"/><path d="M9 13 H16"/><path d="M9 17 H16"/>',
  knowledge: '<path d="M5 4 H17 A2 2 0 0 1 19 6 V20 H7 A2 2 0 0 1 5 18 Z"/><path d="M5 18 A2 2 0 0 1 7 16 H19"/><path d="M9 8 H15"/><path d="M9 11.5 H13"/>',
  box: '<path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z"/><path d="M4 7.5 L12 12 L20 7.5"/><path d="M12 12 V21"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5 V17.5"/><path d="M14.8 9.3 C14.5 8.4 13.4 7.8 12 7.8 C10.4 7.8 9.3 8.6 9.3 9.8 C9.3 12.3 14.8 11.2 14.8 14.2 C14.8 15.4 13.6 16.2 12 16.2 C10.6 16.2 9.5 15.6 9.2 14.6"/>',
  truck: '<path d="M2 6 H14 V16 H2 Z"/><path d="M14 9 H18 L22 13 V16 H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15.5 14"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.8 13.5 L7.5 21 L12 18.5 L16.5 21 L15.2 13.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9 V13 L14.5 14.5"/><path d="M9.5 3 H14.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10 H20.5"/><path d="M8 3 V7"/><path d="M16 3 V7"/>',
  pin: '<path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  warehouse: '<path d="M3 10 L12 4 L21 10 V20 H3 Z"/><path d="M8.5 20 V13 H15.5 V20"/>',
  bars: '<path d="M5 20 V12"/><path d="M12 20 V5"/><path d="M19 20 V14"/>',
  hist: '<path d="M4 20 V13"/><path d="M9 20 V6"/><path d="M14 20 V10"/><path d="M19 20 V16"/>',
  arrow: '<path d="M5 12 H19"/><path d="M13 6 L19 12 L13 18"/>',
  chevron: '<path d="M6 9 L12 15 L18 9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7 L12 13 L20 7"/>',
  bookmark: '<path d="M6 4 H18 V21 L12 17 L6 21 Z"/>',
  link: '<path d="M10 14 A4 4 0 0 0 15.7 14.3 L19 11 A4 4 0 0 0 13.3 5.3 L12 6.5"/><path d="M14 10 A4 4 0 0 0 8.3 9.7 L5 13 A4 4 0 0 0 10.7 18.7 L12 17.5"/>',
  sparkle: '<path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11 V16"/><path d="M12 8 V8.2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5 L11 15.5 L16.5 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9"/>',
  moon: '<path d="M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z"/>',
  logout: '<path d="M15 4 H19 V20 H15"/><path d="M10 8 L6 12 L10 16"/><path d="M6 12 H15"/>',
  download: '<path d="M12 4 V15"/><path d="M7 10 L12 15 L17 10"/><path d="M5 20 H19"/>',
  undo: '<path d="M9 7 L4 12 L9 17"/><path d="M4 12 H15 A5 5 0 0 1 15 22"/>',
  send: '<path d="M4 12 L20 4 L14 20 L11 13 Z"/>',
  close: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3 C9.8 7.9 10.8 7 12.1 7 C13.6 7 14.7 8 14.7 9.3 C14.7 11 12.2 11.2 12.2 13.2"/><path d="M12.2 16.6 V16.8"/>',
  backoffice: '<path d="M4 7 H20"/><circle cx="9" cy="7" r="2"/><path d="M4 17 H20"/><circle cx="15" cy="17" r="2"/>',
  plus: '<path d="M12 5 V19 M5 12 H19"/>',
  trash: '<path d="M5 7 H19"/><path d="M9 7 V4 H15 V7"/><path d="M7 7 L8 20 H16 L17 7"/>',
} as const
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Static, hard-coded path strings above (never user input).
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}
