// src/utils/mapSeverity.ts
export function mapSeverity(s: string): 'info' | 'low' | 'medium' | 'high' | 'critical' {
  switch (s?.toUpperCase()) {
    case 'ERROR':   return 'high';
    case 'WARNING': return 'medium';
    case 'INFO':    return 'low';
    default:        return 'info';
  }
}