/**
 * llm/retriever.ts – Pure TypeScript TF-IDF knowledge base retriever.
 *
 * No external ML/AI libraries or embedding models (CLAUDE.md rule 29).
 * - Loads all markdown guides from backend/src/knowledge/ at module startup.
 * - Splits guides into ~120-word passages.
 * - Indexes terms using TF-IDF with cosine similarity.
 * - Exposes retrieve(query, status, k=4), boosting guides matching elevated domains.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Domain } from '../engine/thresholds.js';
import type { AssessResult } from '../engine/evaluate.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ---- Types -----------------------------------------------------------------

export interface Passage {
  id: string;
  filename: string;
  title: string;
  domain: Domain;
  text: string;
  wordCount: number;
  termFrequencies: Map<string, number>;
  norm: number;
}

export interface RetrievedPassage {
  id: string;
  filename: string;
  title: string;
  domain: Domain;
  text: string;
  score: number;
}

export interface StatusLike {
  domains?: Array<{ domain: string; level: number }>;
}

// ---- Domain mapping for the 7 knowledge guides -----------------------------

const GUIDE_DOMAINS: Record<string, Domain> = {
  'sleep-and-fatigue.md': 'behav',
  'radiation-spe-shelter.md': 'env',
  'cabin-co2.md': 'env',
  'bone-muscle-exercise.md': 'msk',
  'orthostatic-intolerance.md': 'cardio',
  'infection-checklist.md': 'immune',
  'behavioral-health-support.md': 'behav',
};

// ---- Stop words list -------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'did',
  'do', 'does', 'doing', 'don', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'isn', 'it', 'its', 'itself', 'me', 'more', 'most', 'must', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn', 'we', 'were',
  'weren', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'with', 'won', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
]);

// ---- Tokenizer -------------------------------------------------------------

export function tokenize(text: string): string[] {
  // Normalize Unicode subscripts (e.g. CO₂ -> CO2) before tokenizing
  const normalized = text
    .replace(/[\u2080-\u2089]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x2080 + 0x30))
    .toLowerCase();
  const words = normalized.match(/\b[a-z0-9]{2,}\b/g) ?? [];
  return words.filter(w => !STOP_WORDS.has(w));
}

// ---- Split text into passages of ~120 words --------------------------------

function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  const title = match?.[1];
  return title ? title.trim() : filename.replace(/\.md$/, '');
}

export function splitIntoPassages(
  filename: string,
  content: string,
  targetWords: number = 120,
): Omit<Passage, 'termFrequencies' | 'norm'>[] {
  const domain = GUIDE_DOMAINS[filename] ?? 'behav';
  const title = extractTitle(content, filename);

  // Split content by Markdown sections/paragraphs
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const passages: Omit<Passage, 'termFrequencies' | 'norm'>[] = [];
  let currentWords: string[] = [];
  let passageIndex = 1;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);

    if (currentWords.length + words.length > targetWords && currentWords.length > 40) {
      const text = currentWords.join(' ');
      passages.push({
        id: `${filename}#p${passageIndex++}`,
        filename,
        title,
        domain,
        text,
        wordCount: currentWords.length,
      });
      currentWords = [...words];
    } else {
      currentWords.push(...words);
    }
  }

  if (currentWords.length > 0) {
    const text = currentWords.join(' ');
    passages.push({
      id: `${filename}#p${passageIndex}`,
      filename,
      title,
      domain,
      text,
      wordCount: currentWords.length,
    });
  }

  return passages;
}

// ---- TF-IDF Index Class -----------------------------------------------------

export class TfIdfIndex {
  private passages: Passage[] = [];
  private idf: Map<string, number> = new Map();
  private totalPassages: number = 0;

  constructor(knowledgeDir?: string) {
    this.loadDirectory(knowledgeDir);
  }

  public loadDirectory(knowledgeDir?: string): void {
    // Resolve knowledge directory relative to this file or use override
    const dir = knowledgeDir ?? join(__dir, '../knowledge');
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
    } catch {
      // Fallback if running from compiled dist and dist/knowledge exists
      const fallbackDir = join(__dir, '../../src/knowledge');
      try {
        files = readdirSync(fallbackDir).filter(f => f.endsWith('.md') && f !== 'README.md');
      } catch {
        files = [];
      }
    }

    const rawPassages: Omit<Passage, 'termFrequencies' | 'norm'>[] = [];

    for (const file of files) {
      let content = '';
      try {
        content = readFileSync(join(dir, file), 'utf8');
      } catch {
        const fallback = join(__dir, '../../src/knowledge', file);
        content = readFileSync(fallback, 'utf8');
      }
      const filePassages = splitIntoPassages(file, content);
      rawPassages.push(...filePassages);
    }

    this.totalPassages = rawPassages.length;
    if (this.totalPassages === 0) return;

    // Document frequencies (how many passages contain term t)
    const docFrequencies = new Map<string, number>();

    const passageTermCounts: Array<{
      passage: Omit<Passage, 'termFrequencies' | 'norm'>;
      tfMap: Map<string, number>;
    }> = [];

    for (const p of rawPassages) {
      const tokens = tokenize(p.text);
      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
      }
      for (const t of tfMap.keys()) {
        docFrequencies.set(t, (docFrequencies.get(t) ?? 0) + 1);
      }
      passageTermCounts.push({ passage: p, tfMap });
    }

    // Compute IDF: ln(1 + (N / (1 + DF))) + 1
    this.idf.clear();
    for (const [term, df] of docFrequencies.entries()) {
      const idfValue = Math.log(1 + this.totalPassages / (1 + df)) + 1;
      this.idf.set(term, idfValue);
    }

    // Compute TF-IDF weights and vector norms for each passage
    this.passages = passageTermCounts.map(({ passage, tfMap }) => {
      let sumSq = 0;
      const normalizedTf = new Map<string, number>();

      for (const [term, count] of tfMap.entries()) {
        const tf = count / passage.wordCount;
        normalizedTf.set(term, tf);
        const weight = tf * (this.idf.get(term) ?? 1);
        sumSq += weight * weight;
      }

      return {
        ...passage,
        termFrequencies: normalizedTf,
        norm: Math.sqrt(sumSq) || 1,
      };
    });
  }

  public getPassages(): Passage[] {
    return this.passages;
  }

  /**
   * Retrieve the top-k passages matching the query, boosted by elevated domains.
   */
  public search(
    query: string,
    status?: AssessResult | StatusLike | null,
    k: number = 4,
  ): RetrievedPassage[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.passages.length === 0) {
      return [];
    }

    // Query term frequencies and norm
    const queryTf = new Map<string, number>();
    for (const t of queryTokens) {
      queryTf.set(t, (queryTf.get(t) ?? 0) + 1);
    }

    let querySumSq = 0;
    const queryWeights = new Map<string, number>();
    for (const [term, count] of queryTf.entries()) {
      const idf = this.idf.get(term) ?? 1;
      const weight = count * idf;
      queryWeights.set(term, weight);
      querySumSq += weight * weight;
    }
    const queryNorm = Math.sqrt(querySumSq) || 1;

    // Build elevated domain boost lookup
    const domainLevels = new Map<string, number>();
    if (status && Array.isArray(status.domains)) {
      for (const d of status.domains) {
        domainLevels.set(d.domain, d.level);
      }
    }

    const scored: RetrievedPassage[] = [];

    for (const passage of this.passages) {
      let dotProduct = 0;

      for (const [term, qWeight] of queryWeights.entries()) {
        const passageTf = passage.termFrequencies.get(term);
        if (passageTf !== undefined) {
          const passageWeight = passageTf * (this.idf.get(term) ?? 1);
          dotProduct += qWeight * passageWeight;
        }
      }

      if (dotProduct > 0) {
        const rawCosine = dotProduct / (queryNorm * passage.norm);

        // Boost score if the passage belongs to a currently elevated domain:
        // level 1: +25% boost, level 2: +50% boost
        const level = domainLevels.get(passage.domain) ?? 0;
        const boostMultiplier = 1 + level * 0.25;
        const boostedScore = rawCosine * boostMultiplier;

        scored.push({
          id: passage.id,
          filename: passage.filename,
          title: passage.title,
          domain: passage.domain,
          text: passage.text,
          score: parseFloat(boostedScore.toFixed(4)),
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, k);
  }
}

// ---- Singleton instance & public retrieve function -------------------------

export const defaultIndex = new TfIdfIndex();

export function retrieve(
  query: string,
  status?: AssessResult | StatusLike | null,
  k: number = 4,
): RetrievedPassage[] {
  return defaultIndex.search(query, status, k);
}
