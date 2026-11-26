/**
 * Pure, deterministic note-to-questions generator for PDF import.
 * No DOM, no fetch, no Date.now() – testable and predictable.
 */

export type RngFunction = () => number; // 0-1

export interface Question {
  id: string;
  courseId: string;
  question: string;
  choices: string[]; // 4 choices
  correctIndex: number; // 0-3
  explain: string;
  topic: string;
}

/**
 * Generate cloze questions from plain text notes.
 * @param text - Raw notes text
 * @param courseId - Course identifier (e.g., "CV101")
 * @param rng - Deterministic RNG function (0-1)
 * @param max - Maximum questions to generate
 * @returns Array of questions (empty if nothing usable)
 */
/** Sentences that lean on earlier context make unanswerable questions. */
const ANAPHORA = /^(it|its|this|these|that|those|they|their|he|she|his|her|such|here|there|at that time|in this|in that|however|also|thus|then)\b/i;

/** Bibliographic noise that makes terrible questions. */
const CITATION = /https?:|www\.|doi|isbn|retrieved|archived|\bpp?\.\s*\d|et al\.|["“”]|\[\d+\]|\(\d{4}\)/i;

/**
 * Drop reference sections and citation lines before sentence splitting
 * (added by Claude Code after testing with a real Wikipedia PDF export).
 */
export function stripApparatus(text: string): string {
  const cut = text.search(/\n\s*(References|Bibliography|Further reading|External links|See also|Notes)\s*\n/i);
  const body = cut > 200 ? text.slice(0, cut) : text;
  return body
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .split(/\n/)
    .filter((l) => !CITATION.test(l) || l.split(/\s+/).length > 30)
    .join('\n');
}

export function notesToQuestions(
  text: string,
  courseId: string,
  rng: RngFunction,
  max = 20
): Question[] {
  if (!text || !courseId) return [];

  try {
    // Split into sentences (handle abbreviations)
    const sentences = splitSentences(stripApparatus(text));
    
    // Keep sentences of 8-40 words that read like prose (no citations, URLs or quotes)
    const validSentences = sentences.filter((s) => {
      const words = s.trim().split(/\s+/).length;
      return words >= 8 && words <= 40 && !CITATION.test(s) && !ANAPHORA.test(s.trim());
    });

    if (validSentences.length === 0) return [];

    // Extract key terms from all sentences
    const allTerms = extractKeyTerms(validSentences);
    if (allTerms.length < 4) return []; // Need at least 4 terms for distractors

    // Score sentences by definitional quality
    const scoredSentences = validSentences.map((sentence) => ({
      sentence,
      score: scoreDefinitional(sentence),
      terms: extractKeyTerms([sentence]),
    }));

    // Sort by score and take top candidates; prefer genuinely definitional ones
    scoredSentences.sort((a, b) => b.score - a.score);
    const definitional = scoredSentences.filter((x) => x.score > 0);
    if (definitional.length >= 5) scoredSentences.splice(0, scoredSentences.length, ...definitional);

    const questions: Question[] = [];
    const usedSentences = new Set<string>();

    for (const { sentence, terms } of scoredSentences) {
      if (questions.length >= max) break;
      if (usedSentences.has(sentence)) continue;
      if (terms.length === 0) continue;

      // Pick the first key term as the answer
      const correctTerm = terms[0];

      // Build cloze question
      const questionText = buildClozeQuestion(sentence, correctTerm);
      if (questionText.length > 110) continue; // Skip if too long

      // Generate 3 distractors
      const distractors = generateDistractors(correctTerm, allTerms, rng, 3);
      if (distractors.length < 3) continue; // Need exactly 3 distractors

      // Shuffle choices with deterministic RNG
      const choices = [correctTerm, ...distractors];
      const shuffled = shuffleArray(choices, rng);
      const correctIndex = shuffled.indexOf(correctTerm);

      // Explain = full sentence (truncate if too long)
      const explain = sentence.length > 200 ? sentence.slice(0, 197) + "..." : sentence;

      // Topic = the term in Title Case
      const topic = toTitleCase(correctTerm).slice(0, 24);

      questions.push({
        id: `${courseId}-gen${String(questions.length + 1).padStart(2, "0")}`,
        courseId,
        question: questionText,
        choices: shuffled,
        correctIndex,
        explain,
        topic,
      });

      usedSentences.add(sentence);
    }

    return questions;
  } catch {
    // Never throw, just return empty array
    return [];
  }
}

/**
 * Split text into sentences, handling common abbreviations.
 */
function splitSentences(text: string): string[] {
  // Replace abbreviations with placeholders to avoid false splits
  const textWithPlaceholders = text
    .replace(/\be\.g\./gi, "e_g_")
    .replace(/\bi\.e\./gi, "i_e_")
    .replace(/\bvs\./gi, "vs_")
    .replace(/\bDr\./gi, "Dr_")
    .replace(/\bMr\./gi, "Mr_")
    .replace(/\bMrs\./gi, "Mrs_")
    .replace(/\bMs\./gi, "Ms_")
    .replace(/\bProf\./gi, "Prof_")
    .replace(/\bSr\./gi, "Sr_")
    .replace(/\bJr\./gi, "Jr_")
    .replace(/\bInc\./gi, "Inc_")
    .replace(/\bLtd\./gi, "Ltd_")
    .replace(/\bCo\./gi, "Co_")
    .replace(/\bFig\./gi, "Fig_")
    .replace(/\bEq\./gi, "Eq_")
    // Handle decimal numbers
    .replace(/(\d)\.(\d)/g, "$1_DOT_$2");

  // Split on sentence boundaries
  const sentences = textWithPlaceholders
    .split(/[.!?]+/)
    .map((s) =>
      s
        .replace(/e_g_/gi, "e.g.")
        .replace(/i_e_/gi, "i.e.")
        .replace(/vs_/gi, "vs.")
        .replace(/Dr_/gi, "Dr.")
        .replace(/Mr_/gi, "Mr.")
        .replace(/Mrs_/gi, "Mrs.")
        .replace(/Ms_/gi, "Ms.")
        .replace(/Prof_/gi, "Prof.")
        .replace(/Sr_/gi, "Sr.")
        .replace(/Jr_/gi, "Jr.")
        .replace(/Inc_/gi, "Inc.")
        .replace(/Ltd_/gi, "Ltd.")
        .replace(/Co_/gi, "Co.")
        .replace(/Fig_/gi, "Fig.")
        .replace(/Eq_/gi, "Eq.")
        .replace(/_DOT_/g, ".")
        .trim()
    )
    .filter((s) => s.length > 10);

  return sentences;
}

/**
 * Extract key terms from sentences (definitions, capitalized terms, numbers with units).
 */
function extractKeyTerms(sentences: string[]): string[] {
  const terms = new Set<string>();

  for (const sentence of sentences) {
    // Pattern 1: "X is/are/refers to/means Y" - extract X
    const defMatch = sentence.match(
      /\b([A-Z][a-zA-Z0-9\s]{2,30}?)\s+(is|are|refers to|means|represents|defines?)\s+/
    );
    if (defMatch) {
      terms.add(defMatch[1].trim());
    }

    // Pattern 2: Capitalized multi-word terms (2-5 words)
    const capMatches = sentence.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g);
    for (const match of capMatches) {
      terms.add(match[1].trim());
    }

    // Pattern 3: Numbers with units
    const numMatches = sentence.matchAll(/\b(\d+\.?\d*\s*[a-zA-Z]+)\b/g);
    for (const match of numMatches) {
      const term = match[1].trim();
      if (term.length >= 2 && term.length <= 20) {
        terms.add(term);
      }
    }

    // Pattern 4: Technical terms (lowercase but in quotes or italics patterns)
    const quotedMatches = sentence.matchAll(/"([a-z][a-z\s]{2,20})"/gi);
    for (const match of quotedMatches) {
      terms.add(match[1].trim());
    }
  }

  return Array.from(terms).filter((t) => t.length >= 2 && t.length <= 50);
}

/**
 * Score sentence by definitional quality (higher = more likely to be a definition).
 */
function scoreDefinitional(sentence: string): number {
  let score = 0;

  // Bonus for definition keywords
  if (/(is|are)\s+(a|an|the)/i.test(sentence)) score += 3;
  if (/refers to|means|represents|defines?/i.test(sentence)) score += 4;
  if (/known as|called|termed/i.test(sentence)) score += 2;

  // Bonus for capitalized terms
  const capCount = (sentence.match(/\b[A-Z][a-z]+/g) || []).length;
  score += Math.min(capCount, 3);

  // Bonus for being early in paragraph (assume first sentence is more definitional)
  // We can't detect paragraph breaks here, but we can prioritize shorter sentences
  if (sentence.length < 150) score += 1;

  // Penalty for questions
  if (sentence.includes("?")) score -= 5;

  // Penalty for lists or enumerations
  if (/firstly|secondly|finally|however|moreover/i.test(sentence)) score -= 2;

  return score;
}

/**
 * Build a cloze question by replacing the term with "_____".
 * Trim to clause around the blank if too long.
 */
function buildClozeQuestion(sentence: string, term: string): string {
  // Replace term with blank (case-insensitive)
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  let cloze = sentence.replace(regex, "_____");

  // If too long, trim to the clause containing the blank
  if (cloze.length > 110) {
    // Find the blank and extract surrounding clause
    const blankIndex = cloze.indexOf("_____");
    if (blankIndex !== -1) {
      // Extract ~50 chars before and after
      const start = Math.max(0, blankIndex - 40);
      const end = Math.min(cloze.length, blankIndex + 60);
      let trimmed = cloze.slice(start, end);
      
      // Clean up edges
      if (start > 0) trimmed = "..." + trimmed.replace(/^\S+\s/, "");
      if (end < cloze.length) trimmed = trimmed.replace(/\s\S+$/, "") + "...";
      
      cloze = trimmed;
    }
  }

  return cloze.trim();
}

/**
 * Generate N distractors similar to the correct term.
 */
function generateDistractors(
  correctTerm: string,
  allTerms: string[],
  rng: RngFunction,
  count: number
): string[] {
  const isNumeric = /^\d/.test(correctTerm);
  
  // Filter candidates: exclude the correct term and duplicates
  let candidates = allTerms.filter(
    (t) => t.toLowerCase() !== correctTerm.toLowerCase()
  );

  // If correct term is numeric, prefer numeric distractors
  if (isNumeric) {
    const numericCandidates = candidates.filter((t) => /^\d/.test(t));
    if (numericCandidates.length >= count) {
      candidates = numericCandidates;
    }
  } else {
    // Prefer similar length (±50%)
    const targetLen = correctTerm.length;
    const similar = candidates.filter(
      (t) => Math.abs(t.length - targetLen) / targetLen < 0.5
    );
    if (similar.length >= count) {
      candidates = similar;
    }
  }

  // Shuffle and take N
  const shuffled = shuffleArray([...candidates], rng);
  return shuffled.slice(0, count);
}

/**
 * Deterministic array shuffle using RNG.
 */
function shuffleArray<T>(array: T[], rng: RngFunction): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Convert string to Title Case.
 */
function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
