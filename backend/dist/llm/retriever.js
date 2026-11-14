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
const __dir = dirname(fileURLToPath(import.meta.url));
// ---- Domain mapping for the 7 knowledge guides -----------------------------
const GUIDE_DOMAINS = {
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
export function tokenize(text) {
    // Normalize Unicode subscripts (e.g. CO₂ -> CO2) before tokenizing
    const normalized = text
        .replace(/[\u2080-\u2089]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x2080 + 0x30))
        .toLowerCase();
    const words = normalized.match(/\b[a-z0-9]{2,}\b/g) ?? [];
    return words.filter(w => !STOP_WORDS.has(w));
}
// ---- Split text into passages of ~120 words --------------------------------
function extractTitle(content, filename) {
    const match = content.match(/^#\s+(.+)$/m);
    const title = match?.[1];
    return title ? title.trim() : filename.replace(/\.md$/, '');
}
export function splitIntoPassages(filename, content, targetWords = 120) {
    const domain = GUIDE_DOMAINS[filename] ?? 'behav';
    const title = extractTitle(content, filename);
    // Split content by Markdown sections/paragraphs
    const paragraphs = content
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
    const passages = [];
    let currentWords = [];
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
        }
        else {
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
// ---- Bundled fallback knowledge for serverless cloud environments ----
const BUNDLED_KNOWLEDGE = {
    'behavioral-health-support.md': `# Onboard Guide: Behavioral Health and Psychological Support
## Applies When
- Self-reported mood score drops to <=5 (on 1-10 scale) or perceived stress score rises to >=6.
- Crew member expresses signs of interpersonal friction, cognitive fatigue, withdrawal from crew meals, or acute homesickness.
- Mission duration reaches high-stress milestones.
## Action Steps
1. Engage in structured daily off-duty time: spend at least 45 minutes on self-selected non-operational activities.
2. Schedule a private psychological conference (PPC) or video communication with designated family and ground support.
3. Conduct 15-20 minutes of daily mindfulness, progressive muscle relaxation, or guided breathing exercises.
4. Maintain a regular circadian schedule: align personal meal, work, exercise, and sleep times consistently.
5. Participate in communal crew bonding activities, such as shared evening meals, cooperative game time, or movie viewing.
6. Discuss workload pacing and task prioritization with the mission commander.
7. Record mood and stress levels honestly in the daily confidential check-in log.
## Escalation Criteria
- Mood score drops to <=3 or perceived stress score reaches >=8.
- Persistent severe depressive symptoms, panic attacks, thoughts of self-harm, or active interpersonal conflict.
- Marked cognitive impairment or refusal to carry out critical flight safety tasks.
- Contact ground flight surgeon and Crew Behavioral Health & Performance (BHP) officer immediately.
## Source
https://www.nasa.gov/hrp/research/behavioral-health`,
    'bone-muscle-exercise.md': `# Onboard Guide: Bone Density and Muscle Atrophy Countermeasures
## Applies When
- Daily exercise session duration drops below 45 minutes or protocol compliance falls below 85%.
- Ultrasound or bone mineral density indicator shows progressive microgravity deconditioning.
- Crew member reports focal muscle soreness, joint stiffness, or reduction in isometric force output.
## Action Steps
1. Verify scheduled exercise session on the Advanced Resistive Exercise Device (ARED): perform prescribed axial loading.
2. Ensure cylinder vacuum harness and footplate straps on ARED are calibrated to simulate 1-G ground reaction forces.
3. Complete aerobic conditioning on the Cycle Ergometer with Vibration Isolation and Stabilization System (CEVIS) or T2 Treadmill.
4. Distribute physical training evenly across the mission day: pair morning resistive axial loading with afternoon cardio.
5. Inspect foot placement and harness padding to prevent localized pressure sores and nerve impingement.
6. Consume post-workout high-protein dietary rations and ensure hydration levels meet specifications.
7. Record completed reps, load settings, duration, and subjective perceived exertion.
## Escalation Criteria
- Total daily exercise countermeasure completion falls below 20 minutes for two consecutive days.
- Acute musculoskeletal injury, joint effusion, or persistent severe spinal pain following loading maneuvers.
- Inability to perform emergency egress mobility requirements due to muscle weakness.
- Escalate immediately to crew medical officer and ground exercise physiologist.
## Source
https://www.nasa.gov/hrp/research/muscle-and-bone`,
    'cabin-co2.md': `# Onboard Guide: Cabin Carbon Dioxide (CO2) Management
## Applies When
- Ambient cabin CO2 partial pressure rises above 1000 ppm (approximately 3 mmHg).
- Crew experiences mild CO2 toxicity signs: frontal headache, dyspnea on exertion, mental fog, or visual fullness.
- ECLSS Carbon Dioxide Removal Assembly (CDRA) telemetry flags degraded scrubbing efficiency.
## Action Steps
1. Verify localized air velocity and cabin ventilation: ensure inter-module ventilation (IMV) fans are unobstructed.
2. Check primary CDRA desiccant and zeolite adsorbent bed cycling telemetry on the environmental control panel.
3. Switch secondary ECLSS amine scrubbing bed or spare Amine Swingbed assembly from standby to active removal mode.
4. If exercising, temporarily reduce resistance workload or pause aerobic training until cabin CO2 stabilizes below 800 ppm.
5. In sleep compartments, verify continuous airflow exhaust is operating to prevent localized breathing micro-bubbles.
6. Log serial cabin CO2 readings at 30-minute intervals until levels decrease below nominal operational thresholds.
## Escalation Criteria
- Cabin CO2 concentration surpasses 3000 ppm sustained, or spikes above 5000 ppm (contingency threshold).
- Severe throbbing headache, dizziness, visual disturbances, or cognitive confusion reported by any crew member.
- Failure of both primary CDRA and secondary backup carbon dioxide scrubbing systems.
- Don emergency breathing masks with independent O2 supply, contact mission control ground console immediately.
## Source
https://ntrs.nasa.gov/citations/20170001935`,
    'infection-checklist.md': `# Onboard Guide: Spacecraft Infection Control and Immune Vigilance
## Applies When
- Core body temperature exceeds 37.5°C (99.5°F) or symptom score is >=2 on daily health survey.
- Crew member reports localized symptoms: sore throat, persistent cough, rhinorrhea, nausea, diarrhea, skin rash, or dysuria.
- Secondary crew member develops infectious symptoms in the closed spacecraft atmosphere.
## Action Steps
1. Measure and record oral or tympanic body temperature every 4 hours using calibrated clinical thermometer.
2. Don medical-grade particulate surgical mask (N95 equivalent) to minimize airborne aerosol transmission.
3. Clean high-touch shared surfaces using approved antimicrobial disinfectant wipes.
4. Verify environmental control and life support cabin air filters (HEPA filtration) are operating at prescribed flow rates.
5. Increase oral fluid hydration with warm electrolyte liquids and maintain strict rest in designated personal crew quarters.
6. Use disposable meal utensils and isolate dining items from common crew galley supplies.
7. Perform daily visual inspection for mucosal lesions or rashes, noting progression in the daily clinical log.
## Escalation Criteria
- Core body temperature reaches or exceeds 38.3°C (100.9°F) or symptom score is >=4.
- Inability to retain oral hydration due to intractable vomiting or severe gastrointestinal fluid loss.
- Signs of respiratory distress, tachypnea (>24 breaths/min), hemoptysis, or focal chest pain.
- Escalate immediately to flight surgeon and CMO; initiate formal crew medical isolation protocol.
## Source
https://www.cdc.gov/coronavirus/2019-ncov/hcp/clinical-guidance-management-patients.html`,
    'orthostatic-intolerance.md': `# Onboard Guide: Orthostatic Intolerance and Cardiovascular Deconditioning
## Applies When
- Orthostatic heart rate rise exceeds 20 bpm upon transitioning from supine/rest to standing/upright posture.
- Systolic blood pressure drops by >20 mmHg or diastolic drops by >10 mmHg upon standing.
- Crew member reports lightheadedness, presyncope, tunneling vision, or weakness during vertical tasks.
## Action Steps
1. Immediately sit or lie down supine with legs elevated above heart level to facilitate venous return.
2. Engage lower body isometric counter-pressure maneuvers: cross legs and contract thigh, calf, and abdominal muscles firmly.
3. Don anti-gravity garment or graduated lower-body compression stockings (30-40 mmHg pressure gradient).
4. Increase daily fluid intake with isotonic electrolyte rehydration drinks per NASA fluid-loading protocol.
5. Review dietary sodium intake to promote intravascular plasma volume retention.
6. Conduct lower-body negative pressure (LBNP) acclimation sessions if device is available on the mission architecture.
7. Log resting, sitting, and standing blood pressure and pulse readings twice daily.
## Escalation Criteria
- Orthostatic heart rate increase exceeds 30 bpm sustained, or resting systolic blood pressure exceeds 160 mmHg.
- Frank syncope (loss of consciousness) or persistent ataxia preventing safe intravehicular translation.
- Signs of central circulatory compromise or cardiac arrhythmia.
- Contact flight surgeon immediately; suspend all high-workload operations and EVAs.
## Source
https://pubmed.ncbi.nlm.nih.gov/19289835/`,
    'radiation-spe-shelter.md': `# Onboard Guide: Space Radiation and Solar Particle Event (SPE) Shelter
## Applies When
- Dosimeter readings exceed 1.0 mGy/day or space weather alert indicates an active Solar Particle Event (SPE).
- External radiation sensors detect flux exceeding proton threshold energies (>10 MeV, >10 pfu).
- Automated spacecraft alarm announces radiation contingency or mission control issues SPE warning.
## Action Steps
1. Immediately acknowledge and log the alert timestamp, current location, and personal dosimeter reading.
2. Cease all Extravehicular Activity (EVA) immediately; recall EVA crew back into airlock per standard ingress protocol.
3. Ingress designated storm shelter module (central shielding zone with dense equipment, polyethylene, and water walls).
4. Deploy auxiliary water-wall bags and stowage containers around the interior perimeter to maximize mass shielding.
5. Power down non-essential avionics in unshielded compartments to mitigate radiation-induced single-event upsets.
6. Verify personal active and passive dosimeter badges are worn properly on the chest at all times.
7. Maintain low metabolic activity while sheltered to reduce oxygen consumption and respiratory CO2 output.
## Escalation Criteria
- Cumulative dosimeter rate exceeds 5.0 mGy/day or prompt alarm indicates extreme SPE.
- Crew member develops nausea, vomiting, sudden profound fatigue, or skin erythema (signs of acute radiation syndrome).
- Primary communications with mission control ground station are lost during high proton flux.
- Contact flight surgeon and Ground Radiation Safety Officer immediately; initiate level 2 radiation emergency checklist.
## Source
https://www.nasa.gov/hrp/research/space-radiation`,
    'sleep-and-fatigue.md': `# Onboard Guide: Sleep Deficiency and Fatigue Management
## Applies When
- Sleep duration falls below 6.5 hours for two consecutive nights or below 5.5 hours on any single night.
- Crew member reports persistent daytime drowsiness, cognitive sluggishness, or difficulty concentrating on operational tasks.
- Mission workload spikes or sleep shift schedule changes occur.
## Action Steps
1. Review personal sleep environment: ensure crew quarters temperature is between 18°C and 20°C (64°F-68°F).
2. Verify eye mask and earplugs fit properly; secure sleep restraint straps to avoid drifting and waking.
3. Dim cabin lighting 60 minutes before scheduled sleep period; engage blue-depleted lighting mode on workstation displays.
4. Eliminate high-intensity physical training, heavy meals, and caffeine within 4 hours of scheduled sleep.
5. If operational demands permit, take a planned 20-to-30 minute power nap during designated off-duty intervals.
6. Record actual sleep duration, wake episodes, and perceived fatigue in the daily check-in log.
## Escalation Criteria
- Total sleep duration remains under 5.0 hours for two consecutive sleep cycles.
- Sleep deficit is accompanied by critical cognitive task errors or spatial disorientation during EVAs.
- Symptoms of acute insomnia persist despite behavioral countermeasures.
- Escalate immediately to Crew Medical Officer (CMO) and Flight Surgeon at the next comm pass.
## Source
https://www.nasa.gov/hrp/research/behavioral-health`,
};
export class TfIdfIndex {
    passages = [];
    idf = new Map();
    totalPassages = 0;
    constructor(knowledgeDir) {
        this.loadDirectory(knowledgeDir);
    }
    loadDirectory(knowledgeDir) {
        const rawPassages = [];
        // Resolve knowledge directory relative to this file or use override
        const dir = knowledgeDir ?? join(__dir, '../knowledge');
        let files = [];
        try {
            files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
        }
        catch {
            const fallbackDir = join(__dir, '../../src/knowledge');
            try {
                files = readdirSync(fallbackDir).filter(f => f.endsWith('.md') && f !== 'README.md');
            }
            catch {
                files = [];
            }
        }
        for (const file of files) {
            let content = '';
            try {
                content = readFileSync(join(dir, file), 'utf8');
            }
            catch {
                try {
                    const fallback = join(__dir, '../../src/knowledge', file);
                    content = readFileSync(fallback, 'utf8');
                }
                catch {
                    content = BUNDLED_KNOWLEDGE[file] ?? '';
                }
            }
            if (content) {
                const filePassages = splitIntoPassages(file, content);
                rawPassages.push(...filePassages);
            }
        }
        // If disk read found no passages, fall back to all bundled guides
        if (rawPassages.length === 0) {
            for (const [file, content] of Object.entries(BUNDLED_KNOWLEDGE)) {
                const filePassages = splitIntoPassages(file, content);
                rawPassages.push(...filePassages);
            }
        }
        this.totalPassages = rawPassages.length;
        if (this.totalPassages === 0)
            return;
        // Document frequencies (how many passages contain term t)
        const docFrequencies = new Map();
        const passageTermCounts = [];
        for (const p of rawPassages) {
            const tokens = tokenize(p.text);
            const tfMap = new Map();
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
            const normalizedTf = new Map();
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
    getPassages() {
        return this.passages;
    }
    /**
     * Retrieve the top-k passages matching the query, boosted by elevated domains.
     */
    search(query, status, k = 4) {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0 || this.passages.length === 0) {
            return [];
        }
        // Query term frequencies and norm
        const queryTf = new Map();
        for (const t of queryTokens) {
            queryTf.set(t, (queryTf.get(t) ?? 0) + 1);
        }
        let querySumSq = 0;
        const queryWeights = new Map();
        for (const [term, count] of queryTf.entries()) {
            const idf = this.idf.get(term) ?? 1;
            const weight = count * idf;
            queryWeights.set(term, weight);
            querySumSq += weight * weight;
        }
        const queryNorm = Math.sqrt(querySumSq) || 1;
        // Build elevated domain boost lookup
        const domainLevels = new Map();
        if (status && Array.isArray(status.domains)) {
            for (const d of status.domains) {
                domainLevels.set(d.domain, d.level);
            }
        }
        const scored = [];
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
export function retrieve(query, status, k = 4) {
    return defaultIndex.search(query, status, k);
}
//# sourceMappingURL=retriever.js.map