import type { Domain } from '../engine/thresholds.js';
import type { AssessResult } from '../engine/evaluate.js';
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
    domains?: Array<{
        domain: string;
        level: number;
    }>;
}
export declare function tokenize(text: string): string[];
export declare function splitIntoPassages(filename: string, content: string, targetWords?: number): Omit<Passage, 'termFrequencies' | 'norm'>[];
export declare class TfIdfIndex {
    private passages;
    private idf;
    private totalPassages;
    constructor(knowledgeDir?: string);
    loadDirectory(knowledgeDir?: string): void;
    getPassages(): Passage[];
    /**
     * Retrieve the top-k passages matching the query, boosted by elevated domains.
     */
    search(query: string, status?: AssessResult | StatusLike | null, k?: number): RetrievedPassage[];
}
export declare const defaultIndex: TfIdfIndex;
export declare function retrieve(query: string, status?: AssessResult | StatusLike | null, k?: number): RetrievedPassage[];
//# sourceMappingURL=retriever.d.ts.map