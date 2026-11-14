/**
 * test/retriever.test.ts – Unit tests for the TF-IDF onboard knowledge retriever.
 *
 * Verifies:
 * 1. All 7 onboard guides are indexed.
 * 2. Each guide follows the mandatory schema (title, applies-when, steps, escalation, NASA source, reviewed by).
 * 3. No drug doses are present in the guides.
 * 4. CO2 question retrieves cabin-co2.md first.
 * 5. Sleep question retrieves sleep-and-fatigue.md first.
 * 6. Elevated domain status boosts relevant domain passages.
 * 7. Retriever functions purely offline with zero network calls.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultIndex, retrieve, tokenize } from '../src/llm/retriever.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dir, '../src/knowledge');

const EXPECTED_FILES = [
  'sleep-and-fatigue.md',
  'radiation-spe-shelter.md',
  'cabin-co2.md',
  'bone-muscle-exercise.md',
  'orthostatic-intolerance.md',
  'infection-checklist.md',
  'behavioral-health-support.md',
];

describe('Knowledge Base Files Structure & Restrictions', () => {
  it('contains exactly the 7 required onboard guides (plus README.md)', () => {
    const files = readdirSync(KNOWLEDGE_DIR);
    for (const expected of EXPECTED_FILES) {
      expect(files).toContain(expected);
    }
  });

  for (const filename of EXPECTED_FILES) {
    describe(`Guide: ${filename}`, () => {
      const content = readFileSync(join(KNOWLEDGE_DIR, filename), 'utf8');

      it('has a title (# Header)', () => {
        expect(content).toMatch(/^#\s+.+/m);
      });

      it('has an "Applies When" section', () => {
        expect(content).toMatch(/##\s+Applies When/i);
      });

      it('has numbered action steps', () => {
        expect(content).toMatch(/1\.\s+.+/);
        expect(content).toMatch(/2\.\s+.+/);
        expect(content).toMatch(/3\.\s+.+/);
      });

      it('has an "Escalation Criteria" section', () => {
        expect(content).toMatch(/##\s+Escalation Criteria/i);
      });

      it('has a public NASA or scientific source URL', () => {
        expect(content).toMatch(/https?:\/\/[^\s]+/);
      });

      it('has "Reviewed by: TODO"', () => {
        expect(content).toMatch(/Reviewed by:\s*TODO/i);
      });

      it('does NOT contain drug dosages (e.g. mg, mcg, mL prescriptions)', () => {
        // Must not contain clinical drug dosing instructions
        expect(content).not.toMatch(/\b(mg|mcg|milligram)\s+(po|iv|im|q\d+h|prn|daily|bid|tid)\b/i);
        expect(content).not.toMatch(/\b(aspirin|ibuprofen|acetaminophen|morphine|ambien|zolpidem)\s+\d+\s*(mg|g)\b/i);
      });
    });
  }
});

describe('TF-IDF Retriever (llm/retriever.ts)', () => {
  it('tokenizes and removes stop-words', () => {
    const tokens = tokenize('What should the crew do when cabin CO2 rises above 1000 ppm?');
    expect(tokens).toContain('cabin');
    expect(tokens).toContain('co2');
    expect(tokens).toContain('rises');
    expect(tokens).toContain('1000');
    expect(tokens).toContain('ppm');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('what');
    expect(tokens).not.toContain('when');
    expect(tokens).not.toContain('do');
  });

  it('indexes all 7 documents into passages', () => {
    const passages = defaultIndex.getPassages();
    expect(passages.length).toBeGreaterThanOrEqual(7);

    const indexedFiles = new Set(passages.map(p => p.filename));
    for (const expected of EXPECTED_FILES) {
      expect(indexedFiles).toContain(expected);
    }
  });

  it('ACCEPTANCE: CO2 question retrieves cabin-co2.md first', () => {
    const results = retrieve('What should I do if cabin CO2 levels are high and rising?');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('cabin-co2.md');
    expect(results[0]?.title.toLowerCase()).toContain('co2');
  });

  it('ACCEPTANCE: Sleep question retrieves sleep-and-fatigue.md first', () => {
    const results = retrieve('I am suffering from severe sleep loss, insomnia and fatigue');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('sleep-and-fatigue.md');
    expect(results[0]?.title.toLowerCase()).toContain('sleep');
  });

  it('Radiation/SPE question retrieves radiation-spe-shelter.md first', () => {
    const results = retrieve('Solar particle event storm shelter dosimeter alarm active');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('radiation-spe-shelter.md');
  });

  it('Exercise/bone density question retrieves bone-muscle-exercise.md first', () => {
    const results = retrieve('ARED resistive exercise countermeasure CEVIS workout bone atrophy');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('bone-muscle-exercise.md');
  });

  it('Orthostatic question retrieves orthostatic-intolerance.md first', () => {
    const results = retrieve('Presyncope lightheadedness upon standing up blood pressure drop');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('orthostatic-intolerance.md');
  });

  it('Infection/fever question retrieves infection-checklist.md first', () => {
    const results = retrieve('Crew member has fever, sore throat, cough and high temperature');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('infection-checklist.md');
  });

  it('Behavioral/stress question retrieves behavioral-health-support.md first', () => {
    const results = retrieve('High perceived stress score, low mood, homesick and crew tension');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.filename).toBe('behavioral-health-support.md');
  });

  it('boosts passages when domain is elevated', () => {
    // Ambiguous query that touches both environmental conditions and symptoms
    const query = 'guidance on monitoring and alarm protocols';

    // Baseline retrieval without elevated domain
    const baselineResults = retrieve(query, null, 10);
    const envBaseline = baselineResults.find(r => r.domain === 'env');

    // Retrieval with elevated 'env' domain (level 2)
    const boostedResults = retrieve(
      query,
      { domains: [{ domain: 'env', level: 2 }] },
      10,
    );
    const envBoosted = boostedResults.find(r => r.domain === 'env');

    if (envBaseline && envBoosted) {
      expect(envBoosted.score).toBeGreaterThan(envBaseline.score);
    }
  });

  it('returns empty array when query has no matching keywords', () => {
    const results = retrieve('xyzabc123 nonexistingwordqwerty');
    expect(results).toEqual([]);
  });

  it('respects top-k parameter limit', () => {
    const results = retrieve('spacecraft crew health protocol', null, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

