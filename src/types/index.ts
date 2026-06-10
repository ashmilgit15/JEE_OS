// JEE OS — Core Types

export type TopicStatus = 'not_started' | 'learning' | 'completed' | 'revised' | 'mastered';
export type SubjectId = 'physics' | 'chemistry' | 'mathematics';
export type Difficulty = 'easy' | 'medium' | 'jee_main' | 'jee_advanced';
export type ErrorType = 'concept_gap' | 'formula_forgotten' | 'calculation_mistake' | 'time_pressure' | 'misread_question' | 'guessing_error';

export interface Topic {
  id: string;
  name: string;
  status: TopicStatus;
  confidence: number;
  accuracy: number;
  lastRevision: string | null;
  completedDate: string | null;
  revisionDates: string[];
  notes: string;
  excluded?: boolean;
}

export interface Chapter {
  id: string;
  name: string;
  subject: SubjectId;
  topics: Topic[];
  icon: string;
}

export interface Subject {
  id: SubjectId;
  name: string;
  icon: string;
  chapters: Chapter[];
}

export interface StudyLog {
  id: string;
  date: string;
  description: string;
  topicId: string;
  chapterId: string;
  subject: SubjectId;
  duration: number; // minutes
  type: 'study' | 'revision' | 'practice' | 'test' | 'school';
  qualityScore?: number; // 0 to 100
  sleepHours?: number;   // preceding hours of sleep
  distractions?: number; // count of distractions (0 to 5)
}

export interface RevisionItem {
  id: string;
  topicId: string;
  chapterId: string;
  subject: SubjectId;
  topicName: string;
  chapterName: string;
  dueDate: string;
  completedDate: string | null;
  revisionNumber: number; // 1, 2, 3 (for day 1, 7, 30)
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
}

export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topicId: string;
  chapterId: string;
  subject: SubjectId;
  difficulty: Difficulty;
  type: 'mcq' | 'numerical';
  mistakePath?: string; // e.g. "Physics -> Mechanics -> Kinematics -> Relative Velocity"
  // Quality metadata
  skill?: string;          // e.g. "conceptual", "numerical", "graphical"
  source?: string;         // e.g. "PYQ-2023", "NCERT", "Custom"
  solutionSteps?: string;  // step-by-step solution
  commonMistake?: string;  // typical error students make
  userFeedback?: 'clear' | 'confusing' | 'too_easy' | 'too_hard' | null;
  timesServed?: number;    // how many times this question has been shown
  avgAccuracy?: number;    // average accuracy across all attempts
}

export interface TestAttempt {
  id: string;
  date: string;
  type: 'topic' | 'chapter' | 'mixed' | 'daily' | 'mock_main' | 'mock_advanced';
  title: string;
  questions: TestQuestion[];
  answers: (number | null)[];
  timeSpent: number; // seconds
  score: number;
  maxScore: number;
  errors: { questionIndex: number; errorType: ErrorType; mistakePath?: string }[];
  subjectBreakdown: {
    subject: SubjectId;
    correct: number;
    total: number;
    timeSpent: number;
  }[];
}

export interface DailyPlan {
  id: string;
  date: string;
  tasks: PlanTask[];
  completed: boolean;
}

export interface PlanTask {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'study' | 'revision' | 'practice' | 'test' | 'break';
  duration: number; // minutes
  completed: boolean;
  topicId?: string;
  subject?: SubjectId;
}

export interface StudentProfile {
  name: string;
  class: string;
  targetYear: number;
  coaching: string;
  school: string;
  studyHoursPerDay: number;
  preferredStudyTime: string;
  weakTopics: string[];
  strongTopics: string[];
  previousScores: { exam: string; score: number; date: string }[];
  studyStyle: string;
  createdAt: string;
  aiPreferences?: Record<string, string>;
}

export interface CoachInsight {
  id: string;
  date: string;
  type: 'revision_reminder' | 'weakness_alert' | 'accuracy_drop' | 'priority_suggestion' | 'achievement' | 'study_pattern' | 'forgetting_alert';
  message: string;
  priority: 'high' | 'medium' | 'low';
  relatedTopicId?: string;
  relatedSubject?: SubjectId;
  actionable: boolean;
  dismissed: boolean;
  // Trust indicators
  evidence?: string;       // e.g. "Based on 3 test attempts, accuracy dropped from 85% to 62%"
  confidence?: 'high' | 'medium' | 'low';  // how trustworthy this insight is
  dataPoints?: number;     // number of data points backing this insight
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedDate: string | null;
  category: 'streak' | 'revision' | 'mastery' | 'test' | 'study';
}

export interface TopicEvent {
  id: string;
  topicId: string;
  topicName: string;
  subject: SubjectId;
  timestamp: string;
  field: 'status' | 'confidence' | 'accuracy';
  oldValue: string | number;
  newValue: string | number;
  source: 'study_log' | 'test' | 'manual' | 'ai_tutor';
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  category: 'topic' | 'study_log' | 'revision' | 'test' | 'profile' | 'ai_action';
  action: string;       // e.g. 'UPDATE_TOPIC_STATUS', 'ADD_STUDY_LOG', 'COMPLETE_REVISION'
  entityId: string;     // topicId, logId, testId etc.
  entityName: string;   // human-readable name
  field?: string;       // which field changed
  oldValue?: any;
  newValue?: any;
  source: 'manual' | 'ai_tutor' | 'ai_coach' | 'test_engine' | 'revision_engine' | 'system';
  reason?: string;      // why the change was made
}

export interface MistakeEvent {
  id: string;
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  userAnswer: number;
  explanation: string;
  topicId: string;
  topicName: string;
  chapterName: string;
  subject: SubjectId;
  timestamp: string;
  status: 'pending' | 'resolved';
  nextReplayDate: string; // ISO format string
}

export interface StudyResource {
  id: string;
  name: string;
  type: 'pdf' | 'notes' | 'formula_sheet' | 'dpp' | 'reference';
  subject: SubjectId | 'general';
  description: string;
  url: string;
  addedDate: string;
  size?: string;
  source?: string;
}

// ---- Flashcard / Active Recall ----

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  front: string;          // question / formula name / concept
  back: string;           // answer / LaTeX formula / explanation
  subject: SubjectId;
  chapterId: string;
  chapterName: string;
  topicId: string;
  topicName: string;
  tags: string[];         // e.g. ['formula', 'derivation', 'important']
  createdAt: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  easeFactor: number;     // SM-2: starts at 2.5
  intervalDays: number;   // SM-2: current interval
  repetitions: number;    // SM-2: number of successful reviews
  isPinned: boolean;
  isLatex: boolean;       // if true, back is rendered as LaTeX
}

// ---- Formula Sheet ----

export interface FormulaCard {
  id: string;
  title: string;
  latex: string;         // LaTeX source string
  subject: SubjectId;
  chapterName: string;
  tags: string[];
  isPinned: boolean;
  addedAt: string;
  derivation?: string;   // Step-by-step mathematical derivation
}

export interface ActiveTestState {
  id: string;
  title: string;
  type: string;
  questions: TestQuestion[];
  answers: (number | null)[];
  elapsedTime: number;
  difficulty: Difficulty;
  startedAt: string;
}

export interface AppState {
  syllabus: Subject[];
  resources: StudyResource[];
  studyLogs: StudyLog[];
  revisions: RevisionItem[];
  testAttempts: TestAttempt[];
  dailyPlans: DailyPlan[];
  profile: StudentProfile;
  insights: CoachInsight[];
  achievements: Achievement[];
  topicEvents: TopicEvent[];
  mistakes: MistakeEvent[];
  auditLog: AuditEvent[];
  flashcards: Flashcard[];
  formulaCards: FormulaCard[];
  hiddenSubjects: SubjectId[];
  hiddenChapters: string[];
  streaks: {
    currentStudy: number;
    longestStudy: number;
    currentRevision: number;
    longestRevision: number;
    lastStudyDate: string | null;
    lastRevisionDate: string | null;
  };
  weeklyGoals: {
    studyHours: number;
    topicsToComplete: number;
    testsToTake: number;
    revisionsToComplete: number;
  };
  activeTest?: ActiveTestState | null;
}
