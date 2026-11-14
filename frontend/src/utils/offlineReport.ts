/**
 * offlineReport.ts – Client-side plain-text ground report generator.
 * Used when telemetry is offline and the backend cannot be reached directly.
 * Matches backend report format and required disclaimers.
 */
import type { StatusResponse } from '../types.js';

export function generateClientReport(astronautId: string, status: StatusResponse | null, generatedAt: Date = new Date()): string {
  const sepDouble = '='.repeat(76);
  const sepSingle = '-'.repeat(76);
  const lines: string[] = [];

  lines.push(sepDouble);
  lines.push('VITALIS CREW HEALTH STATUS REPORT — GROUND TELEMETRY (OFFLINE CACHE)');
  lines.push(sepDouble);
  lines.push(`Astronaut ID    : ${astronautId}`);
  lines.push(`Generated At    : ${generatedAt.toISOString()}`);
  lines.push(`Logged Entries  : ${status?.entry_count ?? 0}`);
  lines.push('');
  lines.push('DISCLAIMER:');
  lines.push('Decision support only. Not a medical device.');
  lines.push('Ground flight surgeon review required for all clinical countermeasures.');
  lines.push(sepDouble);
  lines.push('');

  const overallLabels = ['NOMINAL (Level 0)', 'WATCH (Level 1)', 'ACTION NEEDED (Level 2)'];
  const overallText = status?.overall !== undefined ? (overallLabels[status.overall] ?? 'UNKNOWN') : 'NO DATA';

  lines.push(`OVERALL HEALTH STATUS : ${overallText}`);
  lines.push(`MULTI-DOMAIN ELEVATION: ${status?.multi_domain ? 'YES (2+ domains elevated)' : 'NO'}`);
  lines.push(
    `HEART RATE BASELINE   : ${
      status?.hrBaseline !== null && status?.hrBaseline !== undefined
        ? `${status.hrBaseline.toFixed(1)} bpm`
        : 'Not established'
    }`,
  );
  lines.push('');

  lines.push(sepSingle);
  lines.push('STATUS PER DOMAIN');
  lines.push(sepSingle);

  if (status?.domains && status.domains.length > 0) {
    for (const d of status.domains) {
      lines.push(`[${d.domain.toUpperCase()}] Level ${d.level}`);
      if (d.metrics) {
        for (const m of d.metrics) {
          lines.push(`  - ${m.key}: ${m.value} (Level ${m.level})`);
        }
      }
      lines.push('');
    }
  } else {
    lines.push('No telemetry domains available in local cache.');
    lines.push('');
  }

  lines.push(sepSingle);
  lines.push('DETERMINISTIC ACTION PROTOCOL');
  lines.push(sepSingle);

  if (status?.overall === 2) {
    lines.push('*** EMERGENCY ACTION REQUIRED (LEVEL 2 CRITICAL STATUS) ***');
    lines.push('1. CONTACT GROUND IMMEDIATELY');
    lines.push('');
  }

  let hasActions = false;
  if (status?.domains) {
    for (const d of status.domains) {
      if (d.level > 0 && d.actions && d.actions.length > 0) {
        hasActions = true;
        lines.push(`[${d.domain.toUpperCase()} - Level ${d.level} Actions]`);
        for (let i = 0; i < d.actions.length; i++) {
          lines.push(`  ${i + 1}. ${d.actions[i]}`);
        }
        lines.push('');
      }
    }
  }

  if (!hasActions) {
    lines.push('All parameters within nominal operational limits. Continue standard flight schedule.');
    lines.push('');
  }

  lines.push(sepDouble);
  lines.push('END OF REPORT — VITALIS ONBOARD DECISION SUPPORT');
  lines.push('Decision support only. Not a medical device.');
  lines.push(sepDouble);

  return lines.join('\n');
}

