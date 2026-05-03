export const MANUFACTURER_FLAGS: Record<string, string> = {
  'Airbus':               '🇪🇺',
  'ATR':                  '🇫🇷',
  'Avro':                 '🇬🇧',
  'Aérospatiale/BAC':     '🇫🇷',
  'BAC':                  '🇬🇧',
  'BAe':                  '🇬🇧',
  'Boeing':               '🇺🇸',
  'Bombardier':           '🇨🇦',
  'COMAC':                '🇨🇳',
  'de Havilland Canada':  '🇨🇦',
  'Douglas':              '🇺🇸',
  'Embraer':              '🇧🇷',
  'Fokker':               '🇳🇱',
  'Ilyushin':             '🇷🇺',
  'Irkut':                '🇷🇺',
  'Lockheed':             '🇺🇸',
  'McDonnell Douglas':    '🇺🇸',
  'Saab':                 '🇸🇪',
  'Sud Aviation':         '🇫🇷',
  'Antonov':              '🇺🇦',
  'Tupolev':              '🇷🇺',
  'Yakovlev':             '🇷🇺',
};

export function manufacturerFlag(manufacturer: string): string {
  return MANUFACTURER_FLAGS[manufacturer] ?? '🌐';
}
