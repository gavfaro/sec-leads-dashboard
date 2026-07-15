// A small TF-IDF + cosine similarity implementation, standing in for
// sklearn.feature_extraction.text.TfidfVectorizer (math_engine/investor_encoder.py
// used `TfidfVectorizer(stop_words="english", max_features=2000)`). Mirrors its
// defaults: smooth IDF (idf = ln((1+n)/(1+df)) + 1), non-sublinear term frequency,
// L2-normalized vectors (so cosine similarity is just a dot product). Not meant to
// be bit-identical to sklearn's output, just a reasonable equivalent -- there's no
// training/fitting beyond counting, so there's nothing sklearn-specific to lose.

const MAX_FEATURES = 2000;

// Same rough word list sklearn's stop_words="english" filters out (English
// function words that add noise, not signal, to short company-description text).
const STOP_WORDS = new Set([
  "a", "about", "above", "across", "after", "afterwards", "again", "against", "all",
  "almost", "alone", "along", "already", "also", "although", "always", "am", "among",
  "amongst", "an", "and", "another", "any", "anyhow", "anyone", "anything", "anyway",
  "anywhere", "are", "around", "as", "at", "back", "be", "became", "because",
  "become", "becomes", "becoming", "been", "before", "beforehand", "behind", "being",
  "below", "beside", "besides", "between", "beyond", "both", "bottom", "but", "by",
  "can", "cannot", "could", "did", "do", "does", "doing", "done", "down", "due",
  "during", "each", "eg", "either", "else", "elsewhere", "empty", "enough", "etc",
  "even", "ever", "every", "everyone", "everything", "everywhere", "except", "few",
  "first", "for", "former", "formerly", "from", "further", "had", "has", "have",
  "having", "he", "hence", "her", "here", "hereafter", "hereby", "herein", "hereupon",
  "hers", "herself", "him", "himself", "his", "how", "however", "hundred", "i", "ie",
  "if", "in", "inc", "indeed", "into", "is", "it", "its", "itself", "just", "keep",
  "last", "latter", "latterly", "least", "less", "made", "many", "may", "me",
  "meanwhile", "might", "more", "moreover", "most", "mostly", "much", "must", "my",
  "myself", "name", "namely", "neither", "never", "nevertheless", "next", "no",
  "nobody", "none", "noone", "nor", "not", "nothing", "now", "nowhere", "of", "off",
  "often", "on", "once", "one", "only", "onto", "or", "other", "others", "otherwise",
  "our", "ours", "ourselves", "out", "over", "own", "part", "per", "perhaps",
  "please", "put", "rather", "re", "same", "see", "seem", "seemed", "seeming",
  "seems", "several", "she", "should", "since", "so", "some", "somehow", "someone",
  "something", "sometime", "sometimes", "somewhere", "still", "such", "than", "that",
  "the", "their", "theirs", "them", "themselves", "then", "thence", "there",
  "thereafter", "thereby", "therefore", "therein", "thereupon", "these", "they",
  "this", "those", "though", "through", "throughout", "thru", "thus", "to",
  "together", "too", "top", "toward", "towards", "under", "until", "up", "upon",
  "us", "used", "using", "various", "very", "via", "was", "we", "well", "were",
  "what", "whatever", "when", "whence", "whenever", "where", "whereafter", "whereas",
  "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while",
  "whither", "who", "whoever", "whole", "whom", "whose", "why", "will", "with",
  "within", "without", "would", "yet", "you", "your", "yours", "yourself",
  "yourselves",
]);

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
  return matches.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

type SparseVector = Map<number, number>;

export class TfidfIndex {
  private vocabulary = new Map<string, number>();
  private idf: number[] = [];
  private docVectors: SparseVector[] = [];
  private fitted = false;

  constructor(docs: string[]) {
    this.fit(docs);
  }

  private fit(docs: string[]): void {
    const docTokensList = docs.map(tokenize);
    const documentFrequency = new Map<string, number>();
    const corpusFrequency = new Map<string, number>();

    for (const tokens of docTokensList) {
      const seenInDoc = new Set<string>();
      for (const t of tokens) {
        corpusFrequency.set(t, (corpusFrequency.get(t) ?? 0) + 1);
        if (!seenInDoc.has(t)) {
          documentFrequency.set(t, (documentFrequency.get(t) ?? 0) + 1);
          seenInDoc.add(t);
        }
      }
    }

    let terms = [...corpusFrequency.keys()];
    if (terms.length === 0) {
      this.fitted = false;
      return;
    }
    if (terms.length > MAX_FEATURES) {
      terms.sort((a, b) => corpusFrequency.get(b)! - corpusFrequency.get(a)!);
      terms = terms.slice(0, MAX_FEATURES);
    }
    terms.sort();
    this.vocabulary = new Map(terms.map((t, i) => [t, i]));

    const n = docs.length;
    this.idf = terms.map((t) => Math.log((1 + n) / (1 + (documentFrequency.get(t) ?? 0))) + 1);
    this.fitted = true;

    this.docVectors = docTokensList.map((tokens) => this.vectorize(tokens));
  }

  private vectorize(tokens: string[]): SparseVector {
    const rawCounts = new Map<number, number>();
    for (const t of tokens) {
      const idx = this.vocabulary.get(t);
      if (idx === undefined) continue;
      rawCounts.set(idx, (rawCounts.get(idx) ?? 0) + 1);
    }

    const vec: SparseVector = new Map();
    for (const [idx, count] of rawCounts) {
      vec.set(idx, count * this.idf[idx]);
    }

    let normSq = 0;
    for (const v of vec.values()) normSq += v * v;
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (const [idx, v] of vec) vec.set(idx, v / norm);
    }
    return vec;
  }

  hasVocabulary(): boolean {
    return this.fitted;
  }

  getDocVector(i: number): SparseVector {
    return this.docVectors[i] ?? new Map();
  }

  transformOne(text: string): SparseVector {
    return this.vectorize(tokenize(text));
  }

  static cosineSimilarity(a: SparseVector, b: SparseVector): number {
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    let dot = 0;
    for (const [idx, v] of smaller) {
      const bv = larger.get(idx);
      if (bv !== undefined) dot += v * bv;
    }
    return dot;
  }
}
