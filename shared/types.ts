// Shared case types. Public types (CaseData) may reach the browser; Secret types are server only.

export type DocKind =
  | 'typed' | 'form' | 'carbon' | 'handwritten' | 'newspaper' | 'email' | 'lab' | 'ledger'
  | 'suspect' | 'floorplan' | 'photo' | 'sealed' | 'handwriting' | 'qr';

export interface UnlockRule {
  qr?: string;   // id of a qr document that must be scanned
  seal?: string; // id of a sealed document whose seal must be broken
  read?: string; // id of a document that must be read
}

export interface CaseDocument {
  id: string;
  kind: DocKind;
  title: string;
  group: string;
  date?: string;
  rotate?: number;
  hidden?: boolean;
  unlockedBy?: UnlockRule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export type FactKind = 'record' | 'statement' | 'absence' | 'window' | 'moment';

export interface TimelineFact {
  id: string;
  lane: string;
  kind: FactKind;
  start: string; // HH:MM
  end?: string;
  label: string;
  place?: string;
  source: string;
  conflictsWith?: string[];
}

export interface Lane { id: string; label: string; suspectId?: string }

export interface PortraitSpec {
  seed: number;
  skin?: string;
  hair?: string;
  hairStyle?: 'short' | 'slick' | 'wavy' | 'bald' | 'scarf' | 'bun';
  mustache?: boolean;
  beard?: boolean;
  glasses?: boolean;
  age?: 'young' | 'middle' | 'old';
  coat?: string;
}

export interface SuspectQuestion { id: string; text: string; unlockedBy?: string }

export interface Suspect {
  id: string;
  name: string;
  role: string;
  age: number;
  address?: string;
  sheet: string[];
  portrait: PortraitSpec;
  portraitAsset?: string;
  questions: SuspectQuestion[];
  openingLine: string;
}

export interface Hint { id: string; tier: number; text: string }
export interface HintQuestion { id: string; question: string; hints: Hint[] }

export interface Option { id: string; label: string }

export interface CaseData {
  id: string;
  title: string;
  subtitle: string;
  place: string;
  date: string;
  reopened: string;
  languages: string[];
  intro: { label: string; stamps: string[]; briefing: string[] };
  victim: { name: string; summary: string };
  groups: { id: string; label: string }[];
  documents: CaseDocument[];
  timeline: { date: string; start: string; end: string; lanes: Lane[]; facts: TimelineFact[] };
  suspects: Suspect[];
  hints: HintQuestion[];
  accusation: { how: Option[]; why: Option[]; proofCount: number };
}

export interface Lie {
  id: string;
  claim: string;
  truth: string;
  caughtBy: string[];
  pointed: string[][]; // every group must match (any word within a group) for a pointed question
  reaction: string;
  spoken?: string; // first-person line for mock mode, and a voice example for the model
  topic?: string[]; // questions on this topic make the suspect commit to the lie
  card: string; // short text for the red CAUGHT card in Notes
}

export interface SecretSuspect {
  persona: {
    voice: string;
    personality: string;
    vocabulary: string;
    tics: string[];
    languageMix: string;
  };
  knows: string[];
  doesNotKnow: string[];
  hides: { what: string; why: string }[];
  lies: Lie[];
  innocentExplanation?: string;
  breakdown?: { minLiesCaught: number; requiredShown: string[] };
  confession?: string;
  falseAdmission?: string; // innocent suspects broken by pressure say this (unreliable)
  shutdown?: string;       // reply to coercive questioning
  mock: { topics: { keywords: string[]; reply: string }[]; fallback: string[]; mood: string };
}

export interface SecretData {
  culprit: string;
  method: string;
  motive: string;
  answers: { how: string; why: string };
  proofDocuments: string[];
  trueTimeline: { time: string; event: string }[];
  documentRoles: Record<string, { role: 'proof' | 'elimination' | 'red-herring' | 'context'; note: string }>;
  eliminations: Record<string, { documents: string[]; refusal: string }>;
  suspects: Record<string, SecretSuspect>;
  epilogue: string[];
  solutionMemo: string[];
}

// Wire types
export interface ChatTurn { role: 'player' | 'suspect'; text: string; shownDocumentId?: string }

export interface InterrogateRequest {
  caseId: string;
  suspectId: string;
  history: ChatTurn[];
  playerMessage: string;
  shownDocumentId?: string;
}

export type Technique = 'open' | 'closed' | 'leading' | 'coercive';
export type CatchQuality = 'locked' | 'adapted';

export interface InterrogateDone {
  type: 'done';
  caughtLieIds: string[];
  newlyCaught: { id: string; card: string; quality: CatchQuality }[];
  technique: Technique;
  pressure: number;
  unreliable: boolean;
  mood: string;
  confessed: boolean;
}

export interface AccuseRequest {
  caseId: string;
  who: string;
  how: string;
  why: string;
  proof: string[];
  hintsUsed: number;
  wrongCharges: number;
}

export interface ScoreBreakdown {
  culprit: number; how: number; why: number; proof: number;
  hintPenalty: number; wrongPenalty: number; total: number; rank: string;
}

export type AccuseResponse =
  | { outcome: 'refused'; text: string; clearedBy: string[] }
  | { outcome: 'solved'; score: ScoreBreakdown; correct: { how: boolean; why: boolean; proof: string[] }; epilogue: string[]; memo: string[] };
