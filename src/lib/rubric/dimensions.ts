export type ConfidenceLevel = "high" | "medium" | "low";

export type Dimension = {
  id: string;
  name: string;
  question: string;
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  rubricText: string;
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High tool reliability",
  medium: "Medium — limited by context",
  low: "Low — directional only",
};

function dim(
  args: Omit<Dimension, "confidenceLabel">,
): Dimension {
  return { ...args, confidenceLabel: CONFIDENCE_LABELS[args.confidence] };
}

export const DIMENSIONS: Dimension[] = [
  dim({
    id: "clarity",
    name: "Clarity",
    question:
      "Could a listener restate your main point in one sentence after you finished?",
    confidence: "high",
    rubricText: `**Signals:** presence of a thesis or ask; cohesion between sentences; setup-before-payoff structure; whether the listener has to work to reconstruct what you wanted them to take away.

**Scoring anchors:**
- **1** — No discernible main point. Listener wouldn't know what to take away.
- **2** — Point exists but is buried; partial reconstruction possible with effort.
- **3** — Point is there but unevenly supported; lands on second pass, not first.
- **4** — Clear point, mostly well-supported; minor digressions.
- **5** — One unmistakable takeaway; every sentence reinforces it.`,
  }),
  dim({
    id: "conciseness",
    name: "Conciseness",
    question: "Did you use roughly the right number of words for the idea?",
    confidence: "high",
    rubricText: `**Signals:** throat-clearing openings ("so basically what I'm saying is..."), restating the same point 2–3 ways, tangents that don't return, words-per-idea ratio.

**Scoring anchors:**
- **1** — Could have been said in half the words with no loss.
- **2** — Significant padding; multiple restatements of the same point.
- **3** — Some padding or one notable tangent, but the message lands.
- **4** — Lean, with one or two ornamental phrases.
- **5** — Every sentence is doing work.`,
  }),
  dim({
    id: "confidence",
    name: "Confidence",
    question: "Did your language commit to a position?",
    confidence: "high",
    rubricText: `**Signals:** hedging ("I think maybe", "kind of", "sort of"), trailing sentences, statements framed as questions, declarative vs. interrogative sentence shape. This is *language-level* confidence — not bravado, not overcommitment.

**Scoring anchors:**
- **1** — Heavy hedging; the language hides what the speaker actually believes.
- **2** — Frequent hedging; positions feel provisional.
- **3** — Mix of committed and hedged statements; net unclear.
- **4** — Mostly committed; occasional hedging where appropriate (genuine uncertainty).
- **5** — Speaker states their view and owns it without overcommitting.`,
  }),
  dim({
    id: "wordPrecision",
    name: "Word Precision",
    question: "Did you reach for the specific word, or settle for a vague one?",
    confidence: "high",
    rubricText: `**Signals:** filler nouns ("stuff", "things", "like that", "kind of like"); over-reliance on intensifiers ("very", "really", "super"); missed opportunities for sharper verbs or nouns; vague references that obscure meaning.

**Scoring anchors:**
- **1** — Heavy reliance on filler nouns and intensifiers; meaning lives in gestures, not words.
- **2** — Several vague placeholders that could have been specific.
- **3** — Mix of precise and lazy choices.
- **4** — Mostly precise; occasional fallback to a vague word.
- **5** — Word choice carries the meaning; a listener could quote the speaker.`,
  }),
];

export function getDimensionById(id: string): Dimension | undefined {
  return DIMENSIONS.find((d) => d.id === id);
}
