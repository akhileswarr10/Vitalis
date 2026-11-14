import type { DomainStatus } from '../types.js';

// Contextual suggested questions based on flagged domains
export const DOMAIN_QUESTIONS: Record<string, string[]> = {
  behav: [
    'Why is my sleep flagged?',
    'What behavioral countermeasures support sleep in microgravity?',
  ],
  env: [
    'What should I do about rising CO2?',
    'What are the storm shelter procedures for radiation elevation?',
  ],
  cardio: [
    'Why is my orthostatic heart rate elevated?',
    'What fluid loading protocol helps with orthostatic intolerance?',
  ],
  msk: [
    'How should I adjust ARED and CEVIS workouts for bone density?',
    'What countermeasures prevent microgravity muscle atrophy?',
  ],
  immune: [
    'What infection control checklist steps apply to fever symptoms?',
    'How do I monitor immune dysregulation in cabin environment?',
  ],
};

export const NOMINAL_QUESTIONS = [
  'How do my current vitals compare to nominal baseline?',
  'What daily countermeasure exercise is recommended today?',
  'What cabin environmental levels are currently nominal?',
];

export function getSuggestedQuestions(flaggedDomains: DomainStatus[] = []): string[] {
  const suggestions: string[] = [];

  for (const fd of flaggedDomains) {
    if (fd.level >= 1) {
      const qList = DOMAIN_QUESTIONS[fd.domain] ?? [];
      for (const q of qList) {
        if (!suggestions.includes(q)) suggestions.push(q);
        if (suggestions.length >= 3) return suggestions;
      }
    }
  }

  // If fewer than 3, fill from nominal suggestions
  for (const nq of NOMINAL_QUESTIONS) {
    if (!suggestions.includes(nq)) suggestions.push(nq);
    if (suggestions.length >= 3) break;
  }

  return suggestions.slice(0, 3);
}

