import type {
  InterviewEvaluation,
  InterviewFeedback,
  InterviewResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  answersTable,
  evaluationsTable,
  interviewsTable,
  questionsTable,
  reportsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

type Topic = "RAG" | "Vector Databases" | "Prompt Engineering" | "Agentic AI";
type Difficulty = "Foundational" | "Intermediate" | "Advanced" | "Expert";

type CandidateContext = {
  name?: string;
  email?: string;
  role?: string;
  experience?: string;
  skills?: string[];
  bio?: string;
  interviewConfig?: {
    role?: string;
    type?: string;
    difficulty?: string;
    topics?: string[];
  };
};

type TurnRecord = {
  question: string;
  answer: string;
  evaluation: InterviewEvaluation;
  topic: Topic;
  difficulty: Difficulty;
};

type Session = {
  id: string;
  candidate: CandidateContext;
  topicOrder: Topic[];
  currentTopic: Topic;
  currentQuestion: string;
  currentDifficulty: Difficulty;
  questionNumber: number;
  turns: TurnRecord[];
  coveredTopics: Set<Topic>;
  askedQuestionKeys: Set<string>;
  maxDifficulty: number;
  lastAnswer?: string;
  lastResponse?: InterviewResponse;
};

const TOTAL_QUESTIONS = 8;
const topics: Topic[] = [
  "RAG",
  "Vector Databases",
  "Prompt Engineering",
  "Agentic AI",
];

const topicPlaybook: Record<
  Topic,
  {
    concepts: Record<string, string[]>;
    prompts: string[];
    followUps: Record<string, string>;
  }
> = {
  RAG: {
    concepts: {
      retrieval: ["retrieval", "search", "retrieve", "relevant documents"],
      grounding: ["ground", "grounding", "citation", "source", "hallucination"],
      chunking: ["chunk", "chunking", "overlap", "document split"],
      ranking: ["rerank", "re-rank", "hybrid", "bm25", "ranking"],
    },
    prompts: [
      "You are building a knowledge assistant for an internal platform. Explain how you would turn a user question into a grounded answer, and what you would measure first.",
      "A retrieval system returns plausible but irrelevant passages. Walk through how you would diagnose and improve the retrieval-to-generation path.",
      "Design a RAG evaluation plan for a support assistant. How would you separate retrieval quality from answer quality?",
    ],
    followUps: {
      retrieval:
        "Your answer needs a sharper retrieval boundary. How would you choose between semantic, lexical, and hybrid retrieval for this workload?",
      grounding:
        "You mentioned answer quality, but not trust. What would you do when the retrieved evidence does not support a confident answer?",
      chunking:
        "Let us go one layer deeper: how do chunk size and overlap affect recall, context quality, and cost?",
      ranking:
        "Take the ranking problem further. Where would reranking sit in the pipeline, and what signal would it optimize?",
    },
  },
  "Vector Databases": {
    concepts: {
      embeddings: ["embedding", "vector", "representation", "dimension"],
      indexing: ["index", "hnsw", "ivf", "ann", "approximate nearest"],
      filters: ["filter", "metadata", "tenant", "namespace", "partition"],
      operations: ["latency", "recall", "throughput", "scale", "freshness", "delete"],
    },
    prompts: [
      "Choose a vector database strategy for a multi-tenant product. Discuss indexing, metadata isolation, and the tradeoff between recall and latency.",
      "A semantic search feature is fast in development but slow at production scale. Explain the design levers you would inspect before changing vendors.",
      "How would you keep vector search results fresh when source documents change frequently?",
    ],
    followUps: {
      embeddings:
        "What properties of an embedding model would you validate before committing to it for this domain?",
      indexing:
        "Explain the recall and latency tradeoff behind approximate nearest-neighbor indexing in practical terms.",
      filters:
        "How would you enforce tenant isolation when metadata filters and vector similarity both affect the query?",
      operations:
        "What production signals would tell you the search system is degrading even if average latency looks healthy?",
    },
  },
  "Prompt Engineering": {
    concepts: {
      instructions: ["instruction", "prompt", "system message", "constraint"],
      evaluation: ["evaluate", "test", "rubric", "regression", "quality"],
      structure: ["schema", "structured", "few-shot", "example", "format"],
      safety: ["injection", "unsafe", "guardrail", "policy", "untrusted"],
    },
    prompts: [
      "Design a prompt contract for an assistant that must return reliable structured data from messy user input.",
      "A prompt works in a demo but regresses after a model upgrade. Describe the evaluation and iteration loop you would put around it.",
      "How would you defend a tool-using assistant against instructions embedded in untrusted retrieved content?",
    ],
    followUps: {
      instructions:
        "How would you keep the instruction hierarchy explicit when user intent and application policy conflict?",
      evaluation:
        "What would a useful prompt regression set contain, and how would you decide whether a change is actually better?",
      structure:
        "Why would you prefer constrained structured output over asking the model to format a response carefully?",
      safety:
        "Give a concrete example of an untrusted instruction reaching the model and how your design contains it.",
    },
  },
  "Agentic AI": {
    concepts: {
      planning: ["plan", "planner", "decompose", "reasoning", "workflow"],
      tools: ["tool", "function", "api", "action", "permission"],
      state: ["state", "memory", "context", "checkpoint", "resume"],
      reliability: ["retry", "timeout", "trace", "observe", "fallback", "human"],
    },
    prompts: [
      "Design an agent that can investigate a production incident using approved tools. Explain planning, permissions, and the point where a human must stay in control.",
      "An agent sometimes repeats a failing tool call and loses track of its goal. How would you make its workflow recoverable and observable?",
      "When is a deterministic workflow better than an autonomous agent? Use reliability and operating cost in your answer.",
    ],
    followUps: {
      planning:
        "What would make the plan inspectable and interruptible rather than an opaque chain of actions?",
      tools:
        "How would you scope tool permissions and validate arguments before an agent can affect a production system?",
      state:
        "What state would you persist so the workflow can resume safely after a timeout or process restart?",
      reliability:
        "Name the failure signals you would trace, and explain when retrying would make the incident worse.",
    },
  },
};

const clamp = (value: number, min = 0, max = 10) =>
  Math.max(min, Math.min(max, Math.round(value * 10) / 10));

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const unique = (items: string[]) => [...new Set(items)];

function words(text: string) {
  return text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [];
}

function inferTopicOrder(candidate: CandidateContext): Topic[] {
  const requested = candidate.interviewConfig?.topics ?? [];
  const preferred = topics.filter((topic) =>
    requested.some((item) => item.toLowerCase().includes(topic.toLowerCase().split(" ")[0])),
  );
  return unique([...preferred, ...topics]) as Topic[];
}

function difficultyFor(session: Session): Difficulty {
  if (session.maxDifficulty >= 4) return "Expert";
  if (session.maxDifficulty === 3) return "Advanced";
  if (session.maxDifficulty === 2) return "Intermediate";
  return "Foundational";
}

function questionKey(topic: Topic, prompt: string) {
  return `${topic}:${prompt}`;
}

function buildQuestion(
  session: Session,
  topic: Topic,
  options: { followUpConcept?: string; challenge?: boolean } = {},
) {
  const playbook = topicPlaybook[topic];
  if (options.followUpConcept && playbook.followUps[options.followUpConcept]) {
    return playbook.followUps[options.followUpConcept];
  }

  const available = playbook.prompts.filter(
    (prompt) => !session.askedQuestionKeys.has(questionKey(topic, prompt)),
  );
  const prompt = available[(session.questionNumber + session.turns.length) % Math.max(1, available.length)] ?? playbook.prompts[0];
  if (options.challenge) {
    return `${prompt} Be explicit about one failure mode, one tradeoff, and how you would validate the design.`;
  }
  return prompt;
}

function evaluateAnswer(topic: Topic, answer: string): InterviewEvaluation {
  const playbook = topicPlaybook[topic];
  const normalizedWords = words(answer);
  const normalized = answer.toLowerCase();
  const wordCount = normalizedWords.length;
  const admissionOfUncertainty = /\b(i\s+don'?t\s+know|not\s+sure|no\s+idea|cannot\s+answer)\b/i.test(answer);
  const conceptHits = Object.entries(playbook.concepts).filter(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  const hitNames = conceptHits.map(([name]) => name);
  const missingConcepts = Object.keys(playbook.concepts).filter((name) => !hitNames.includes(name));
  const practicalSignals = ["tradeoff", "latency", "cost", "failure", "measure", "monitor", "scale", "example", "production", "users"];
  const claritySignals = ["first", "then", "because", "however", "assumption", "constraint", "for example"];
  const misconceptionSignals = [
    ["vectors are exact", "Vector indexes are exact by default; approximate indexes trade recall for speed."],
    ["prompt injection is solved", "Prompt wording alone does not solve prompt injection; trust boundaries and tool controls matter."],
    ["retry forever", "Unbounded retries can amplify failures; retries need limits, backoff, and an exit path."],
    ["more context is always better", "More context can add noise and cost; retrieval quality and context limits still matter."],
  ];
  const misconceptions = misconceptionSignals
    .filter(([signal]) => normalized.includes(signal))
    .map(([, correction]) => correction);
  const practicalCount = practicalSignals.filter((signal) => normalized.includes(signal)).length;
  const clarityCount = claritySignals.filter((signal) => normalized.includes(signal)).length;
  const relevantWords = Object.values(playbook.concepts)
    .flat()
    .filter((keyword) => normalized.includes(keyword));
  const isLikelyIrrelevant = wordCount >= 4 && relevantWords.length === 0 && practicalCount === 0;
  const technicalCorrectness = clamp(
    3.1 + hitNames.length * 1.15 + Math.min(1.4, wordCount / 80) - misconceptions.length * 1.8,
  );
  const depth = clamp(3.4 + Math.min(4.2, wordCount / 22) + Math.min(1.4, practicalCount * 0.35) - missingConcepts.length * 0.35);
  const clarity = clamp(3.8 + Math.min(3.4, wordCount / 30) + Math.min(1.8, clarityCount * 0.35) - (wordCount < 18 ? 1.2 : 0));
  const practicalUnderstanding = clamp(3 + Math.min(4.5, practicalCount * 0.65) + Math.min(1.2, wordCount / 80) - misconceptions.length * 0.9);
  let score = clamp(
    technicalCorrectness * 0.35 +
      depth * 0.25 +
      clarity * 0.2 +
      practicalUnderstanding * 0.2,
  );
  if (admissionOfUncertainty) score = 1.5;
  if (isLikelyIrrelevant) score = Math.min(score, 2.5);
  const relevance = admissionOfUncertainty
    ? 1
    : isLikelyIrrelevant
      ? 2
      : clamp(5.5 + Math.min(3.5, relevantWords.length * 0.55 + practicalCount * 0.25));
  const completeness = admissionOfUncertainty
    ? 0.5
    : clamp(4 + Math.min(4.5, conceptHits.length * 1.1 + wordCount / 100) - missingConcepts.length * 0.35);
  const verdict = admissionOfUncertainty
    ? "uncertain"
    : isLikelyIrrelevant
      ? "irrelevant"
      : misconceptions.length > 0
        ? "incorrect"
        : wordCount < 8 || missingConcepts.length >= 3
          ? "incomplete"
          : score >= 7.5 && completeness >= 7
            ? "correct"
            : "partially_correct";
  const strengths: string[] = [];
  if (technicalCorrectness >= 7) strengths.push("Uses technically relevant concepts");
  if (depth >= 7) strengths.push("Explains reasoning beyond the headline");
  if (clarity >= 7) strengths.push("Communicates a structured line of thought");
  if (practicalUnderstanding >= 7) strengths.push("Connects concepts to production constraints");
  if (!strengths.length && !admissionOfUncertainty && !isLikelyIrrelevant) strengths.push("Attempts a direct answer under pressure");
  const weaknesses: string[] = [];
  if (technicalCorrectness < 6.5) weaknesses.push("Tighten the technical model before choosing a solution");
  if (depth < 6.5) weaknesses.push("Name the tradeoffs and failure modes explicitly");
  if (clarity < 6.5) weaknesses.push("Give the answer a clearer beginning, middle, and decision");
  if (practicalUnderstanding < 6.5) weaknesses.push("Connect the concept to an observable production behavior");
  if (misconceptions.length) weaknesses.push("Correct an important technical assumption");
  if (admissionOfUncertainty) weaknesses.push("Build a baseline explanation before reaching for implementation detail");
  if (isLikelyIrrelevant) weaknesses.push("Stay anchored to the question and name the relevant technical mechanism");
  const needsFollowUp = score < 7.2 || missingConcepts.length >= 2 || misconceptions.length > 0;
  const reason = misconceptions.length
    ? "A technical assumption needs to be tested before the interview moves on."
    : missingConcepts.length
      ? `The next prompt will probe ${missingConcepts[0]} because it was not yet visible in the answer.`
      : score >= 8
        ? "Your answer showed enough range to raise the difficulty and move to a new curriculum area."
        : "The next prompt will test whether you can apply the idea under a tighter constraint.";
  return {
    score,
    technicalCorrectness,
    relevance,
    completeness,
    depth,
    clarity,
    practicalUnderstanding,
    strengths: strengths.slice(0, 2),
    weaknesses: weaknesses.slice(0, 2),
    missingConcepts: missingConcepts.slice(0, 3),
    misconceptions,
    verdict,
    needsFollowUp,
    reason,
    topic,
  };
}

function chooseNext(session: Session, evaluation: InterviewEvaluation) {
  const unseenTopic = session.topicOrder.find((topic) => !session.coveredTopics.has(topic));
  if (session.turns.length < topics.length && unseenTopic) {
    return {
      topic: unseenTopic,
      followUpConcept: undefined,
      challenge: evaluation.score >= 7.5,
      reason: "You have shown a baseline here. I’m widening the interview to another curriculum area so the signal is not one-dimensional.",
    };
  }
  if (evaluation.needsFollowUp && evaluation.missingConcepts[0]) {
    return {
      topic: session.currentTopic,
      followUpConcept: evaluation.missingConcepts[0],
      challenge: false,
      reason: `I’m staying with ${session.currentTopic} to test the missing concept before moving on.`,
    };
  }
  if (evaluation.score >= 7.5) {
    session.maxDifficulty = Math.min(4, session.maxDifficulty + 1);
    const nextTopic = session.topicOrder.find((topic) => topic !== session.currentTopic) ?? session.currentTopic;
    return {
      topic: nextTopic,
      followUpConcept: undefined,
      challenge: true,
      reason: "That answer was strong enough to increase difficulty and add a production constraint.",
    };
  }
  return {
    topic: session.currentTopic,
    followUpConcept: undefined,
    challenge: false,
    reason: "I’m keeping the topic close and testing whether you can make the reasoning more concrete.",
  };
}

function reactionFor(evaluation: InterviewEvaluation) {
  if (evaluation.verdict === "incorrect") {
    return `That answer contains a technical misconception. ${evaluation.misconceptions[0] || "Let’s isolate the underlying mechanism before moving on."}`;
  }
  if (evaluation.verdict === "irrelevant") {
    return "That response did not address the technical mechanism in the prompt, so I’m narrowing the next question to the core concept.";
  }
  if (evaluation.verdict === "uncertain") {
    return "You called out uncertainty rather than guessing. I’m going back to the foundation and checking the smallest useful explanation.";
  }
  if (evaluation.verdict === "incomplete") {
    return `You started in the right area, but ${evaluation.missingConcepts[0] || "a key part of the reasoning"} is still missing.`;
  }
  if (evaluation.verdict === "correct") {
    return "Your answer covered the key mechanism and the next question will test it under a harder constraint.";
  }
  return `Your answer showed part of the model; the next question will probe ${evaluation.missingConcepts[0] || "the tradeoff"} more directly.`;
}

function buildFeedback(session: Session): InterviewFeedback {
  const evaluations = session.turns.map((turn) => turn.evaluation);
  const topicPerformance: Record<string, number> = {};
  for (const topic of topics) {
    const topicScores = evaluations.filter((evaluation) => evaluation.topic === topic).map((evaluation) => evaluation.score);
    if (topicScores.length) topicPerformance[topic] = Math.round(average(topicScores) * 10);
  }
  const overallScore = Math.round(average(evaluations.map((item) => item.score)) * 10);
  const technicalScore = Math.round(average(evaluations.map((item) => item.technicalCorrectness)) * 10);
  const communicationScore = Math.round(average(evaluations.map((item) => item.clarity)) * 10);
  const problemSolvingScore = Math.round(
    average(evaluations.map((item) => (item.depth + (item.practicalUnderstanding ?? item.depth)) / 2)) * 10,
  );
  const strengths = unique(evaluations.flatMap((item) => item.strengths)).slice(0, 4);
  const gaps = unique(evaluations.flatMap((item) => item.weaknesses)).slice(0, 4);
  const misconceptions = unique(evaluations.flatMap((item) => item.misconceptions)).slice(0, 4);
  const next = unique(
    evaluations
      .flatMap((item) => item.missingConcepts)
      .map((concept) => `Revise ${concept} and explain it with a production example.`),
  ).slice(0, 4);
  if (!next.length) next.push("Repeat the lowest-scoring topic with a timed production scenario.");
  const difficultyReached = difficultyFor(session);
  const summary =
    overallScore >= 80
      ? "Candidate demonstrates strong technical range and can reason through production constraints with limited prompting."
      : overallScore >= 65
        ? "Candidate demonstrates a solid foundation with useful instincts; deeper tradeoff analysis would make the answers more reliable."
        : "Candidate is building the right foundation but needs more structured technical explanations and applied practice.";
  const hiringAssessment =
    overallScore >= 80
      ? "Strong signal for an advanced technical conversation; validate ownership depth with a real system walkthrough."
      : overallScore >= 65
        ? "Promising intermediate signal; continue probing production judgment and depth before making a hiring decision."
        : "Early signal; recommend targeted practice on the identified gaps before a high-stakes technical loop.";
  return {
    summary,
    strengths,
    gaps,
    next,
    overallScore,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    topicPerformance,
    misconceptions,
    difficultyReached,
    hiringAssessment,
    scoreHistory: session.turns.map((turn, index) => ({
      question: index + 1,
      topic: turn.topic,
      score: Math.round(turn.evaluation.score * 10),
      difficulty: turn.difficulty,
    })),
  };
}

const sessions = new Map<string, Session>();
const inFlight = new Set<string>();

const userIdFor = (session: Session) =>
  `demo-${createHash("sha256").update(session.candidate.email || session.id).digest("hex").slice(0, 24)}`;

const questionIdFor = (session: Session, sequence: number) => `${session.id}:question:${sequence}`;
const answerIdFor = (session: Session, sequence: number) => `${session.id}:answer:${sequence}`;
const evaluationIdFor = (session: Session, sequence: number) => `${session.id}:evaluation:${sequence}`;
const reportIdFor = (session: Session) => `${session.id}:report`;

function serializeSession(session: Session) {
  return {
    id: session.id,
    candidate: session.candidate,
    topicOrder: session.topicOrder,
    currentTopic: session.currentTopic,
    currentQuestion: session.currentQuestion,
    currentDifficulty: session.currentDifficulty,
    questionNumber: session.questionNumber,
    turns: session.turns,
    coveredTopics: [...session.coveredTopics],
    askedQuestionKeys: [...session.askedQuestionKeys],
    maxDifficulty: session.maxDifficulty,
    lastAnswer: session.lastAnswer,
    lastResponse: session.lastResponse,
  };
}

function deserializeSession(state: unknown): Session | null {
  if (!state || typeof state !== "object") return null;
  const raw = state as Partial<Session> & { coveredTopics?: Topic[]; askedQuestionKeys?: string[] };
  if (!raw.id || !raw.candidate || !raw.currentTopic || !raw.currentQuestion) return null;
  return {
    id: raw.id,
    candidate: raw.candidate,
    topicOrder: raw.topicOrder || topics,
    currentTopic: raw.currentTopic,
    currentQuestion: raw.currentQuestion,
    currentDifficulty: raw.currentDifficulty || "Foundational",
    questionNumber: raw.questionNumber || 1,
    turns: raw.turns || [],
    coveredTopics: new Set(raw.coveredTopics || []),
    askedQuestionKeys: new Set(raw.askedQuestionKeys || []),
    maxDifficulty: raw.maxDifficulty || 1,
    lastAnswer: raw.lastAnswer,
    lastResponse: raw.lastResponse,
  };
}

async function persistSession(session: Session) {
  await db
    .update(interviewsTable)
    .set({
      difficulty: session.currentDifficulty,
      status: session.turns.length >= TOTAL_QUESTIONS ? "completed" : "in_progress",
      engineState: serializeSession(session),
    })
    .where(eq(interviewsTable.id, session.id));
}

async function persistStart(session: Session) {
  const userId = userIdFor(session);
  await db
    .insert(usersTable)
    .values({
      id: userId,
      name: session.candidate.name || null,
      email: session.candidate.email || null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        name: session.candidate.name || null,
        email: session.candidate.email || null,
        updatedAt: new Date(),
      },
    });
  await db
    .insert(interviewsTable)
    .values({
      id: session.id,
      userId,
      role: session.candidate.interviewConfig?.role || session.candidate.role || "Technical interview",
      interviewType: session.candidate.interviewConfig?.type || "Adaptive technical",
      difficulty: session.currentDifficulty,
      status: "in_progress",
      candidateContext: session.candidate,
      engineState: serializeSession(session),
    })
    .onConflictDoUpdate({
      target: interviewsTable.id,
      set: {
        status: "in_progress",
        difficulty: session.currentDifficulty,
        candidateContext: session.candidate,
        engineState: serializeSession(session),
      },
    });
  await db
    .insert(questionsTable)
    .values({
      id: questionIdFor(session, 1),
      interviewId: session.id,
      questionText: session.currentQuestion,
      topic: session.currentTopic,
      difficulty: session.currentDifficulty,
      sequence: 1,
    })
    .onConflictDoNothing();
}

async function persistTurn(session: Session, turn: TurnRecord) {
  const sequence = session.turns.length;
  const answerId = answerIdFor(session, sequence);
  await db
    .insert(answersTable)
    .values({
      id: answerId,
      questionId: questionIdFor(session, sequence),
      interviewId: session.id,
      answerText: turn.answer,
    })
    .onConflictDoNothing();
  await db
    .insert(evaluationsTable)
    .values({
      id: evaluationIdFor(session, sequence),
      answerId,
      interviewId: session.id,
      correctness: turn.evaluation.technicalCorrectness,
      relevance: turn.evaluation.relevance ?? turn.evaluation.practicalUnderstanding ?? 0,
      completeness: turn.evaluation.completeness ?? (turn.evaluation.missingConcepts.length ? 10 - turn.evaluation.missingConcepts.length * 2 : 10),
      depth: turn.evaluation.depth,
      communication: turn.evaluation.clarity,
      overallScore: turn.evaluation.score,
      verdict: turn.evaluation.verdict ?? (turn.evaluation.score >= 8 ? "correct" : turn.evaluation.score >= 6 ? "partially_correct" : "incomplete"),
      strengths: turn.evaluation.strengths,
      mistakes: turn.evaluation.weaknesses,
      missingConcepts: turn.evaluation.missingConcepts,
      misconceptions: turn.evaluation.misconceptions,
      feedback: turn.evaluation.reason,
      nextAction: turn.evaluation.needsFollowUp ? "clarify" : "advance",
      needsFollowUp: turn.evaluation.needsFollowUp,
    })
    .onConflictDoNothing();
}

async function persistQuestion(session: Session) {
  await db
    .insert(questionsTable)
    .values({
      id: questionIdFor(session, session.questionNumber),
      interviewId: session.id,
      questionText: session.currentQuestion,
      topic: session.currentTopic,
      difficulty: session.currentDifficulty,
      sequence: session.questionNumber,
    })
    .onConflictDoNothing();
}

async function persistReport(session: Session, feedback: InterviewFeedback) {
  await db
    .update(interviewsTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      overallScore: feedback.overallScore,
      summary: feedback.summary,
      engineState: serializeSession(session),
    })
    .where(eq(interviewsTable.id, session.id));
  await db
    .insert(reportsTable)
    .values({
      id: reportIdFor(session),
      interviewId: session.id,
      overallScore: feedback.overallScore,
      strengths: feedback.strengths,
      weaknesses: feedback.gaps,
      knowledgeGaps: feedback.misconceptions,
      recommendedTopics: feedback.next,
      summary: feedback.summary,
      recommendation: feedback.hiringAssessment,
      reportData: feedback,
    })
    .onConflictDoUpdate({
      target: reportsTable.interviewId,
      set: {
        overallScore: feedback.overallScore,
        strengths: feedback.strengths,
        weaknesses: feedback.gaps,
        knowledgeGaps: feedback.misconceptions,
        recommendedTopics: feedback.next,
        summary: feedback.summary,
        recommendation: feedback.hiringAssessment,
        reportData: feedback,
      },
    });
}

async function loadSession(id: string) {
  const stored = await db
    .select({ engineState: interviewsTable.engineState })
    .from(interviewsTable)
    .where(eq(interviewsTable.id, id))
    .limit(1);
  return stored[0] ? deserializeSession(stored[0].engineState) : null;
}

export async function startInterview(id: string, candidate: CandidateContext): Promise<InterviewResponse> {
  const existing = sessions.get(id) || await loadSession(id);
  if (existing && existing.turns.length < TOTAL_QUESTIONS) {
    sessions.set(id, existing);
    return existing.lastResponse || {
      reply: existing.currentQuestion,
      done: false,
      progress: Math.round((existing.turns.length / TOTAL_QUESTIONS) * 100),
      questionsAnswered: existing.turns.length,
      totalQuestions: TOTAL_QUESTIONS,
      questionNumber: existing.questionNumber,
      topic: existing.currentTopic,
      difficulty: existing.currentDifficulty,
      nextQuestionReason: "Resumed from the persisted interview state.",
    };
  }
  const session: Session = {
    id,
    candidate,
    topicOrder: inferTopicOrder(candidate),
    currentTopic: topics[0],
    currentQuestion: "",
    currentDifficulty: "Foundational",
    questionNumber: 1,
    turns: [],
    coveredTopics: new Set(),
    askedQuestionKeys: new Set(),
    maxDifficulty: 1,
  };
  session.currentQuestion = buildQuestion(session, session.currentTopic);
  session.askedQuestionKeys.add(questionKey(session.currentTopic, session.currentQuestion));
  session.coveredTopics.add(session.currentTopic);
  sessions.set(id, session);
  const response = {
    reply: session.currentQuestion,
    done: false,
    progress: 0,
    questionsAnswered: 0,
    totalQuestions: TOTAL_QUESTIONS,
    questionNumber: 1,
    topic: session.currentTopic,
    difficulty: session.currentDifficulty,
    nextQuestionReason: "I’m starting with a foundational prompt to establish your technical baseline.",
  };
  session.lastResponse = response;
  await persistStart(session);
  return response;
}

export async function continueInterview(id: string, answer: string): Promise<InterviewResponse | null> {
  if (inFlight.has(id)) return null;
  inFlight.add(id);
  try {
  let session = sessions.get(id);
  if (!session) {
    session = await loadSession(id) || undefined;
    if (session) sessions.set(id, session);
  }
  if (!session) return null;
  if (session.lastAnswer === answer && session.lastResponse) return session.lastResponse;
  const evaluation = evaluateAnswer(session.currentTopic, answer);
  const turn: TurnRecord = {
    question: session.currentQuestion,
    answer,
    evaluation,
    topic: session.currentTopic,
    difficulty: session.currentDifficulty,
  };
  session.turns.push(turn);
  await persistTurn(session, turn);
  if (session.turns.length >= TOTAL_QUESTIONS) {
    const feedback = buildFeedback(session);
    const response = {
      reply: `${reactionFor(evaluation)} That completes the adaptive interview. I’ve assembled your report from the answer-level signals above.`,
      done: true,
      evaluation,
      feedback,
      progress: 100,
      questionsAnswered: session.turns.length,
      totalQuestions: TOTAL_QUESTIONS,
      questionNumber: session.turns.length,
      topic: session.currentTopic,
      difficulty: session.currentDifficulty,
    };
    session.lastAnswer = answer;
    session.lastResponse = response;
    await persistReport(session, feedback);
    return response;
  }
  const next = chooseNext(session, evaluation);
  session.currentTopic = next.topic;
  session.currentDifficulty = difficultyFor(session);
  session.questionNumber = session.turns.length + 1;
  session.currentQuestion = buildQuestion(session, next.topic, {
    followUpConcept: next.followUpConcept,
    challenge: next.challenge,
  });
  session.askedQuestionKeys.add(questionKey(next.topic, session.currentQuestion));
  session.coveredTopics.add(next.topic);
  await persistQuestion(session);
  const response = {
    reply: `${reactionFor(evaluation)} ${session.currentQuestion}`,
    done: false,
    evaluation,
    progress: Math.round((session.turns.length / TOTAL_QUESTIONS) * 100),
    questionsAnswered: session.turns.length,
    totalQuestions: TOTAL_QUESTIONS,
    questionNumber: session.questionNumber,
    topic: session.currentTopic,
    difficulty: session.currentDifficulty,
    nextQuestionReason: next.reason,
  };
  session.lastAnswer = answer;
  session.lastResponse = response;
  await persistSession(session);
  return response;
  } finally {
    inFlight.delete(id);
  }
}

export function getSessionFeedback(id: string) {
  const session = sessions.get(id);
  return session ? buildFeedback(session) : null;
}