'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { AppState, StudyLog, RevisionItem, TestAttempt, DailyPlan, StudentProfile, CoachInsight, Achievement, TopicStatus, SubjectId, PlanTask, MistakeEvent, AuditEvent, StudyResource, Flashcard, FormulaCard, FlashcardRating, Subject, ActiveTestState } from '@/types';
import { defaultSyllabus } from '@/data/syllabus';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format, differenceInDays, parseISO } from 'date-fns';
import { initSession, loadStudyLogs, loadRevisions, loadTestAttempts, loadUserTopicStatus, loadProfile, syncStudyLogs, syncRevisions, syncTestAttempts, syncTopicStatus, syncProfile, syncMistakes, loadMistakes } from '@/utils/supabase/sync';

const STORAGE_KEY = 'jee-os-state';

// Default student profile
const defaultProfile: StudentProfile = {
  name: '',
  class: '11',
  targetYear: 2027,
  coaching: '',
  school: '',
  studyHoursPerDay: 6,
  preferredStudyTime: 'evening',
  weakTopics: [],
  strongTopics: [],
  previousScores: [],
  studyStyle: 'visual',
  createdAt: new Date().toISOString(),
  aiPreferences: {},
};

// Default achievements
const defaultAchievements: Achievement[] = [
  { id: 'ach-1', title: 'First Step', description: 'Complete your first topic', icon: '🎯', earnedDate: null, category: 'mastery' },
  { id: 'ach-2', title: 'Week Warrior', description: '7-day study streak', icon: '🔥', earnedDate: null, category: 'streak' },
  { id: 'ach-3', title: 'Month Master', description: '30-day study streak', icon: '⚡', earnedDate: null, category: 'streak' },
  { id: 'ach-4', title: 'Revision Champion', description: 'Complete 50 revisions', icon: '🏆', earnedDate: null, category: 'revision' },
  { id: 'ach-5', title: 'Test Ace', description: 'Score 90%+ on any test', icon: '💎', earnedDate: null, category: 'test' },
  { id: 'ach-6', title: 'Physics Pioneer', description: 'Complete 10 Physics topics', icon: '⚛️', earnedDate: null, category: 'mastery' },
  { id: 'ach-7', title: 'Chemistry Catalyst', description: 'Complete 10 Chemistry topics', icon: '🧪', earnedDate: null, category: 'mastery' },
  { id: 'ach-8', title: 'Math Maverick', description: 'Complete 10 Math topics', icon: '📊', earnedDate: null, category: 'mastery' },
  { id: 'ach-9', title: 'Study Machine', description: 'Log 100 hours of study', icon: '⏰', earnedDate: null, category: 'study' },
  { id: 'ach-10', title: 'Perfect Score', description: 'Get 100% on any test', icon: '🌟', earnedDate: null, category: 'test' },
  { id: 'ach-11', title: 'Revision Rookie', description: 'Complete your first revision', icon: '🔄', earnedDate: null, category: 'revision' },
  { id: 'ach-12', title: 'Quick Learner', description: 'Complete 5 topics in one day', icon: '🚀', earnedDate: null, category: 'mastery' },
];

// Initial state
const initialState: AppState = {
  syllabus: defaultSyllabus,
  resources: [],
  studyLogs: [],
  revisions: [],
  testAttempts: [],
  dailyPlans: [],
  profile: defaultProfile,
  insights: [],
  achievements: defaultAchievements,
  topicEvents: [],
  mistakes: [],
  auditLog: [],
  flashcards: [],
  formulaCards: [],
  hiddenSubjects: [],
  hiddenChapters: [],
  streaks: {
    currentStudy: 0,
    longestStudy: 0,
    currentRevision: 0,
    longestRevision: 0,
    lastStudyDate: null,
    lastRevisionDate: null,
  },
  weeklyGoals: {
    studyHours: 30,
    topicsToComplete: 5,
    testsToTake: 3,
    revisionsToComplete: 10,
  },
  activeTest: null,
};

// Action types
type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'IMPORT_SYLLABUS'; payload: Subject[] }
  | { type: 'TOGGLE_TOPIC_EXCLUSION'; payload: { topicId: string } }
  | { type: 'UPDATE_TOPIC_STATUS'; payload: { topicId: string; status: TopicStatus; confidence?: number; accuracy?: number; source?: 'study_log' | 'test' | 'manual' | 'ai_tutor' } }
  | { type: 'ADD_STUDY_LOG'; payload: StudyLog }
  | { type: 'ADD_REVISION'; payload: RevisionItem }
  | { type: 'COMPLETE_REVISION'; payload: { topicId: string; revisionNumber: number } }
  | { type: 'ADD_TEST_ATTEMPT'; payload: TestAttempt }
  | { type: 'UPDATE_PROFILE'; payload: Partial<StudentProfile> }
  | { type: 'ADD_INSIGHT'; payload: CoachInsight }
  | { type: 'DISMISS_INSIGHT'; payload: string }
  | { type: 'UPDATE_DAILY_PLAN'; payload: DailyPlan }
  | { type: 'COMPLETE_PLAN_TASK'; payload: { planId: string; taskId: string } }
  | { type: 'EARN_ACHIEVEMENT'; payload: string }
  | { type: 'UPDATE_STREAKS'; payload: Partial<AppState['streaks']> }
  | { type: 'UPDATE_WEEKLY_GOALS'; payload: Partial<AppState['weeklyGoals']> }
  | { type: 'SCHEDULE_REVISIONS'; payload: { topicId: string; chapterId: string; subject: SubjectId; topicName: string; chapterName: string; completedDate: string } }
  | { type: 'ADD_MISTAKE'; payload: MistakeEvent }
  | { type: 'RESOLVE_MISTAKE'; payload: { mistakeId: string } }
  | { type: 'APPEND_AUDIT'; payload: AuditEvent }
  | { type: 'ADD_RESOURCE'; payload: StudyResource }
  | { type: 'REMOVE_RESOURCE'; payload: string }
  | { type: 'RESET_SYLLABUS_PROGRESS'; payload?: { scope?: 'all' | 'subject' | 'chapter' | 'topic'; subjectIds?: SubjectId[]; chapterIds?: string[]; topicIds?: string[] } }
  | { type: 'BULK_UPDATE_TOPICS'; payload: { topicIds: string[]; status: TopicStatus; confidence?: number; accuracy?: number; source?: 'study_log' | 'test' | 'manual' | 'ai_tutor' } }
  | { type: 'ADD_FLASHCARD'; payload: Flashcard }
  | { type: 'DELETE_FLASHCARD'; payload: string }
  | { type: 'REVIEW_FLASHCARD'; payload: { id: string; rating: FlashcardRating } }
  | { type: 'TOGGLE_FLASHCARD_PIN'; payload: string }
  | { type: 'ADD_FORMULA_CARD'; payload: FormulaCard }
  | { type: 'DELETE_FORMULA_CARD'; payload: string }
  | { type: 'TOGGLE_FORMULA_PIN'; payload: string }
  | { type: 'TOGGLE_HIDDEN_SUBJECT'; payload: SubjectId }
  | { type: 'TOGGLE_HIDDEN_CHAPTER'; payload: string }
  | { type: 'START_ACTIVE_TEST'; payload: ActiveTestState }
  | { type: 'UPDATE_ACTIVE_TEST'; payload: Partial<ActiveTestState> }
  | { type: 'CLEAR_ACTIVE_TEST' }
  | { type: 'RESET_STATE' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;

    case 'START_ACTIVE_TEST':
      return { ...state, activeTest: action.payload };

    case 'UPDATE_ACTIVE_TEST':
      return {
        ...state,
        activeTest: state.activeTest ? { ...state.activeTest, ...action.payload } : null,
      };

    case 'CLEAR_ACTIVE_TEST':
      return { ...state, activeTest: null };

    case 'RESET_STATE':
      return {
        ...initialState,
        profile: {
          ...defaultProfile,
          createdAt: new Date().toISOString(),
        },
        achievements: defaultAchievements.map(a => ({ ...a, earnedDate: null })),
      };

    case 'RESET_SYLLABUS_PROGRESS': {
      const now = new Date().toISOString();
      const scope = action.payload?.scope ?? 'all';
      const subjectFilter = new Set(action.payload?.subjectIds ?? []);
      const chapterFilter = new Set(action.payload?.chapterIds ?? []);
      const topicFilter = new Set(action.payload?.topicIds ?? []);

      const matchesScope = (subjectId: SubjectId, chapterId: string, topicId: string) => {
        if (scope === 'all') return true;
        if (scope === 'subject') return subjectFilter.has(subjectId);
        if (scope === 'chapter') return chapterFilter.has(chapterId);
        if (scope === 'topic') return topicFilter.has(topicId);
        return true;
      };

      const matchesScopeItem = (subjectId: SubjectId, chapterId: string, topicId: string) => {
        if (scope === 'all') return true;
        if (scope === 'subject') return subjectFilter.has(subjectId);
        if (scope === 'chapter') return chapterFilter.has(chapterId);
        if (scope === 'topic') return topicFilter.has(topicId);
        return false;
      };

      let matchedCount = 0;
      const newSyllabus = state.syllabus.map(subject => ({
        ...subject,
        chapters: subject.chapters.map(chapter => ({
          ...chapter,
          topics: chapter.topics.map(topic => {
            if (!matchesScope(subject.id, chapter.id, topic.id)) return topic;
            matchedCount++;
            return {
              ...topic,
              status: 'not_started' as TopicStatus,
              confidence: 0,
              accuracy: 0,
              lastRevision: null,
              completedDate: null,
              revisionDates: [],
            };
          }),
        })),
      }));

      // Helper to retrieve subject and chapter of a topic
      const getTopicInfo = (tId: string) => {
        for (const sub of state.syllabus) {
          for (const ch of sub.chapters) {
            if (ch.topics.some(t => t.id === tId)) {
              return { subjectId: sub.id, chapterId: ch.id };
            }
          }
        }
        return null;
      };

      // Filter other state fields based on the matching scope
      const newRevisions = state.revisions.filter(
        r => !matchesScopeItem(r.subject, r.chapterId, r.topicId)
      );

      const newStudyLogs = state.studyLogs.filter(
        l => !matchesScopeItem(l.subject, l.chapterId, l.topicId)
      );

      const newMistakes = state.mistakes.filter(m => {
        const info = getTopicInfo(m.topicId);
        if (!info) return true;
        return !matchesScopeItem(info.subjectId, info.chapterId, m.topicId);
      });

      const newTopicEvents = (state.topicEvents || []).filter(e => {
        const info = getTopicInfo(e.topicId);
        if (!info) return true;
        return !matchesScopeItem(info.subjectId, info.chapterId, e.topicId);
      });

      const newTestAttempts = state.testAttempts.filter(t => {
        if (scope === 'all') return false;
        if (scope === 'subject') {
          return !t.subjectBreakdown.some(s => subjectFilter.has(s.subject));
        }
        if (scope === 'chapter') {
          return !t.questions.some(q => chapterFilter.has(q.chapterId));
        }
        if (scope === 'topic') {
          return !t.questions.some(q => topicFilter.has(q.topicId));
        }
        return true;
      });

      const newDailyPlans = scope === 'all' ? [] : state.dailyPlans;

      const newStreaks = scope === 'all'
        ? {
            currentStudy: 0,
            longestStudy: 0,
            currentRevision: 0,
            longestRevision: 0,
            lastStudyDate: null,
            lastRevisionDate: null,
          }
        : state.streaks;

      const newInsights = scope === 'all' ? [] : state.insights;

      const newAchievements = scope === 'all'
        ? defaultAchievements.map(a => ({ ...a, earnedDate: null }))
        : state.achievements;

      const scopeLabel = scope === 'all'
        ? 'All Topics'
        : scope === 'subject'
          ? `Subjects: ${Array.from(subjectFilter).join(', ')}`
          : scope === 'chapter'
            ? `Chapters: ${Array.from(chapterFilter).join(', ')}`
            : `Topics: ${Array.from(topicFilter).join(', ')}`;

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: now,
        category: 'topic',
        action: 'RESET_SYLLABUS_PROGRESS',
        entityId: 'syllabus',
        entityName: scopeLabel,
        source: 'ai_tutor',
        reason: `AI tutor reset ${matchedCount} topic(s) in scope '${scope}' to not_started, confidence=0, accuracy=0`,
      };

      return {
        ...state,
        syllabus: newSyllabus,
        revisions: newRevisions,
        studyLogs: newStudyLogs,
        testAttempts: newTestAttempts,
        mistakes: newMistakes,
        topicEvents: newTopicEvents,
        dailyPlans: newDailyPlans,
        streaks: newStreaks,
        insights: newInsights,
        achievements: newAchievements,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500),
      };
    }

    case 'BULK_UPDATE_TOPICS': {
      const { topicIds, status, confidence, accuracy } = action.payload;
      const topicIdSet = new Set(topicIds);
      const now = new Date().toISOString();
      let updated = 0;
      const newSyllabus = state.syllabus.map(subject => ({
        ...subject,
        chapters: subject.chapters.map(chapter => ({
          ...chapter,
          topics: chapter.topics.map(topic => {
            if (!topicIdSet.has(topic.id)) return topic;
            updated++;
            return {
              ...topic,
              status,
              confidence: confidence ?? (status === 'not_started' ? 0 : 4),
              accuracy: accuracy ?? (status === 'not_started' ? 0 : 80),
              completedDate: status === 'completed' || status === 'revised' || status === 'mastered' ? now : topic.completedDate,
              lastRevision: status === 'revised' || status === 'mastered' ? now : topic.lastRevision,
              revisionDates: status === 'revised' || status === 'mastered' ? [...topic.revisionDates, now] : topic.revisionDates,
            };
          }),
        })),
      }));
      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: now,
        category: 'topic',
        action: 'BULK_UPDATE_TOPICS',
        entityId: 'bulk',
        entityName: `${updated} topics`,
        field: 'status',
        newValue: status,
        source: 'ai_tutor',
        reason: `AI tutor bulk-updated ${updated} topic(s) to ${status}`,
      };
      return {
        ...state,
        syllabus: newSyllabus,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500),
      };
    }

    case 'IMPORT_SYLLABUS': {
      const newSyllabus = action.payload;
      const now = new Date().toISOString();
      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: now,
        category: 'profile',
        action: 'IMPORT_SYLLABUS',
        entityId: 'syllabus',
        entityName: 'Syllabus Layout',
        source: 'manual',
        reason: 'Imported custom syllabus configuration JSON',
      };

      return {
        ...state,
        syllabus: newSyllabus,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500),
      };
    }

    case 'TOGGLE_TOPIC_EXCLUSION': {
      const { topicId } = action.payload;
      const now = new Date().toISOString();
      let topicName = '';
      for (const sub of state.syllabus) {
        for (const ch of sub.chapters) {
          const t = ch.topics.find(x => x.id === topicId);
          if (t) {
            topicName = t.name;
            break;
          }
        }
      }

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: now,
        category: 'topic',
        action: 'TOGGLE_TOPIC_EXCLUSION',
        entityId: topicId,
        entityName: topicName,
        source: 'manual',
        reason: `Toggled exclusion state for topic: ${topicName}`,
      };

      return {
        ...state,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500),
        syllabus: state.syllabus.map(subject => ({
          ...subject,
          chapters: subject.chapters.map(chapter => ({
            ...chapter,
            topics: chapter.topics.map(topic =>
              topic.id === topicId
                ? {
                    ...topic,
                    excluded: !topic.excluded,
                  }
                : topic
            ),
          })),
        })),
      };
    }

    case 'UPDATE_TOPIC_STATUS': {
      const { topicId, status, confidence, accuracy, source = 'manual' } = action.payload;
      const now = new Date().toISOString();

      // Find old values of topic properties to log TopicEvents
      let oldStatus: TopicStatus = 'not_started';
      let oldConfidence = 0;
      let oldAccuracy = 0;
      let topicName = '';
      let subjectId: SubjectId = 'physics';

      for (const sub of state.syllabus) {
        for (const ch of sub.chapters) {
          const t = ch.topics.find(x => x.id === topicId);
          if (t) {
            oldStatus = t.status;
            oldConfidence = t.confidence;
            oldAccuracy = t.accuracy;
            topicName = t.name;
            subjectId = sub.id;
            break;
          }
        }
      }

      const newEvents: any[] = [];
      if (status !== oldStatus) {
        newEvents.push({
          id: uuidv4(),
          topicId,
          topicName,
          subject: subjectId,
          timestamp: now,
          field: 'status',
          oldValue: oldStatus,
          newValue: status,
          source,
        });
      }
      if (confidence !== undefined && confidence !== oldConfidence) {
        newEvents.push({
          id: uuidv4(),
          topicId,
          topicName,
          subject: subjectId,
          timestamp: now,
          field: 'confidence',
          oldValue: oldConfidence,
          newValue: confidence,
          source,
        });
      }
      if (accuracy !== undefined && accuracy !== oldAccuracy) {
        newEvents.push({
          id: uuidv4(),
          topicId,
          topicName,
          subject: subjectId,
          timestamp: now,
          field: 'accuracy',
          oldValue: oldAccuracy,
          newValue: accuracy,
          source,
        });
      }

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: now,
        category: 'topic',
        action: 'UPDATE_TOPIC_STATUS',
        entityId: topicId,
        entityName: topicName,
        field: 'status',
        oldValue: oldStatus,
        newValue: status,
        source: (source === 'ai_tutor' ? 'ai_tutor' : 'manual'),
        reason: `Updated topic status to ${status} via ${source}`,
      };

      return {
        ...state,
        topicEvents: [...newEvents, ...(state.topicEvents || [])],
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500),
        syllabus: state.syllabus.map(subject => ({
          ...subject,
          chapters: subject.chapters.map(chapter => ({
            ...chapter,
            topics: chapter.topics.map(topic =>
              topic.id === topicId
                ? {
                    ...topic,
                    status,
                    confidence: confidence ?? (status === 'not_started' ? 0 : (topic.confidence || 4)),
                    accuracy: accuracy ?? (status === 'not_started' ? 0 : (topic.accuracy || 80)),
                    completedDate: status === 'completed' || status === 'revised' || status === 'mastered' ? now : (status === 'not_started' ? null : topic.completedDate),
                    lastRevision: status === 'revised' || status === 'mastered' ? now : (status === 'not_started' ? null : topic.lastRevision),
                    revisionDates: status === 'revised' || status === 'mastered' ? [...topic.revisionDates, now] : (status === 'not_started' ? [] : topic.revisionDates),
                  }
                : topic
            ),
          })),
        })),
      };
    }

    case 'ADD_STUDY_LOG': {
      const nowStr = new Date().toISOString();
      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: nowStr,
        category: 'study_log',
        action: 'ADD_STUDY_LOG',
        entityId: action.payload.id,
        entityName: action.payload.description,
        newValue: action.payload,
        source: 'manual',
      };
      return {
        ...state,
        studyLogs: [action.payload, ...state.studyLogs],
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500)
      };
    }

    case 'ADD_REVISION':
      return { ...state, revisions: [...state.revisions, action.payload] };

    case 'COMPLETE_REVISION': {
      const { topicId, revisionNumber } = action.payload;
      const nowStr = new Date().toISOString();
      
      // Get the topic info to evaluate current performance
      let accuracy = 70;
      let confidence = 3;
      let chapterId = '';
      let subject: SubjectId = 'physics';
      let topicName = '';
      let chapterName = '';
      
      for (const sub of state.syllabus) {
        for (const ch of sub.chapters) {
          const t = ch.topics.find(x => x.id === topicId);
          if (t) {
            accuracy = t.accuracy;
            confidence = t.confidence;
            chapterId = ch.id;
            subject = sub.id;
            topicName = t.name;
            chapterName = ch.name;
            break;
          }
        }
      }

      // Map accuracy/confidence to SM-2 quality (q: 0-5)
      let q = 3;
      if (accuracy >= 90) q = 5;
      else if (accuracy >= 75) q = 4;
      else if (accuracy >= 60) q = 3;
      else if (accuracy >= 45) q = 2;
      else if (accuracy >= 30) q = 1;
      else q = 0;

      if (confidence >= 4 && q < 5) q = Math.min(5, q + 1);
      if (confidence <= 1 && q > 0) q = Math.max(0, q - 1);

      // Fetch the revision item being completed
      const revItem = state.revisions.find(
        r => r.topicId === topicId && r.revisionNumber === revisionNumber
      );
      
      let easeFactor = revItem?.easeFactor ?? 2.5;
      let intervalDays = revItem?.intervalDays ?? 1;
      let repetitions = revItem?.repetitions ?? 0;

      // Apply SM-2 formulas
      if (q < 3) {
        repetitions = 0;
        intervalDays = 1;
      } else {
        if (repetitions === 0) {
          intervalDays = 1;
        } else if (repetitions === 1) {
          intervalDays = 6;
        } else {
          intervalDays = Math.round(intervalDays * easeFactor);
        }
        repetitions += 1;
      }
      easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

      const nextDueDate = format(addDays(new Date(), intervalDays), 'yyyy-MM-dd');

      const nextRevisionItem: RevisionItem = {
        id: uuidv4(),
        topicId,
        chapterId,
        subject,
        topicName,
        chapterName,
        dueDate: nextDueDate,
        completedDate: null,
        revisionNumber: revisionNumber + 1,
        easeFactor,
        intervalDays,
        repetitions,
      };

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: nowStr,
        category: 'revision',
        action: 'COMPLETE_REVISION',
        entityId: topicId,
        entityName: `Revision R${revisionNumber}`,
        newValue: { ...action.payload, easeFactor, intervalDays, repetitions },
        source: 'manual',
      };

      return {
        ...state,
        revisions: [
          ...state.revisions.map(rev =>
            rev.topicId === topicId && rev.revisionNumber === revisionNumber
              ? { ...rev, completedDate: nowStr, easeFactor, intervalDays, repetitions }
              : rev
          ),
          nextRevisionItem
        ],
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500)
      };
    }

    case 'ADD_TEST_ATTEMPT': {
      const nowStr = new Date().toISOString();
      const attempt = action.payload;
      
      // Calculate new accuracies for topics tested in this attempt
      const testedTopicIds = Array.from(new Set(attempt.questions.map(q => q.topicId).filter(Boolean)));
      const allAttempts = [attempt, ...state.testAttempts];
      
      const topicAccuracies: Record<string, number> = {};
      testedTopicIds.forEach(topicId => {
        let correctCount = 0;
        let attemptedCount = 0;
        
        allAttempts.forEach(att => {
          att.questions.forEach((q, idx) => {
            if (q.topicId === topicId) {
              const userAnswer = att.answers[idx];
              if (userAnswer !== null) {
                attemptedCount++;
                if (userAnswer === q.correctAnswer) {
                  correctCount++;
                }
              }
            }
          });
        });
        
        if (attemptedCount > 0) {
          topicAccuracies[topicId] = Math.round((correctCount / attemptedCount) * 100);
        }
      });

      const newSyllabus = state.syllabus.map(subject => ({
        ...subject,
        chapters: subject.chapters.map(chapter => ({
          ...chapter,
          topics: chapter.topics.map(topic => {
            if (topicAccuracies[topic.id] !== undefined) {
              return {
                ...topic,
                accuracy: topicAccuracies[topic.id],
                status: topic.status === 'not_started' ? 'learning' : topic.status,
              };
            }
            return topic;
          }),
        })),
      }));

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: nowStr,
        category: 'test',
        action: 'ADD_TEST_ATTEMPT',
        entityId: attempt.id,
        entityName: attempt.title,
        newValue: attempt,
        source: 'test_engine',
      };
      return {
        ...state,
        testAttempts: allAttempts,
        syllabus: newSyllabus,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500)
      };
    }

    case 'UPDATE_PROFILE': {
      const nowStr = new Date().toISOString();
      const payload = action.payload;
      const standardKeys = [
        'name',
        'class',
        'targetYear',
        'coaching',
        'school',
        'studyHoursPerDay',
        'preferredStudyTime',
        'weakTopics',
        'strongTopics',
        'previousScores',
        'studyStyle',
        'createdAt'
      ];

      const updatedProfile = { ...state.profile };
      const customPrefs: Record<string, string> = { ...(state.profile.aiPreferences || {}) };

      Object.entries(payload).forEach(([key, val]) => {
        if (key === 'aiPreferences') {
          if (val && typeof val === 'object') {
            Object.entries(val).forEach(([k, v]) => {
              customPrefs[k] = String(v);
            });
          }
        } else if (standardKeys.includes(key)) {
          if (key === 'targetYear' || key === 'studyHoursPerDay') {
            (updatedProfile as any)[key] = Number(val);
          } else if (key === 'weakTopics' || key === 'strongTopics') {
            if (typeof val === 'string') {
              (updatedProfile as any)[key] = val
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            } else if (Array.isArray(val)) {
              (updatedProfile as any)[key] = val;
            } else {
              (updatedProfile as any)[key] = [];
            }
          } else {
            (updatedProfile as any)[key] = val;
          }
        } else {
          customPrefs[key] = String(val);
        }
      });

      updatedProfile.aiPreferences = customPrefs;

      const newAudit: AuditEvent = {
        id: uuidv4(),
        timestamp: nowStr,
        category: 'profile',
        action: 'UPDATE_PROFILE',
        entityId: 'profile',
        entityName: updatedProfile.name || 'Profile',
        newValue: payload,
        source: 'manual',
      };

      return {
        ...state,
        profile: updatedProfile,
        auditLog: [newAudit, ...(state.auditLog || [])].slice(0, 500)
      };
    }

    case 'APPEND_AUDIT':
      return {
        ...state,
        auditLog: [action.payload, ...(state.auditLog || [])].slice(0, 500)
      };

    case 'ADD_RESOURCE':
      if (state.resources.some(r => r.url && r.url === action.payload.url)) {
        return state;
      }
      return {
        ...state,
        resources: [action.payload, ...state.resources],
      };

    case 'REMOVE_RESOURCE':
      return {
        ...state,
        resources: state.resources.filter(r => r.id !== action.payload),
      };

    case 'ADD_INSIGHT':
      return { ...state, insights: [action.payload, ...state.insights] };

    case 'DISMISS_INSIGHT':
      return {
        ...state,
        insights: state.insights.map(i =>
          i.id === action.payload ? { ...i, dismissed: true } : i
        ),
      };

    case 'UPDATE_DAILY_PLAN': {
      const exists = state.dailyPlans.find(p => p.date === action.payload.date);
      return {
        ...state,
        dailyPlans: exists
          ? state.dailyPlans.map(p => p.date === action.payload.date ? action.payload : p)
          : [...state.dailyPlans, action.payload],
      };
    }

    case 'COMPLETE_PLAN_TASK':
      return {
        ...state,
        dailyPlans: state.dailyPlans.map(plan =>
          plan.id === action.payload.planId
            ? {
                ...plan,
                tasks: plan.tasks.map(task =>
                  task.id === action.payload.taskId ? { ...task, completed: true } : task
                ),
              }
            : plan
        ),
      };

    case 'EARN_ACHIEVEMENT':
      return {
        ...state,
        achievements: state.achievements.map(a =>
          a.id === action.payload ? { ...a, earnedDate: new Date().toISOString() } : a
        ),
      };

    case 'UPDATE_STREAKS':
      return { ...state, streaks: { ...state.streaks, ...action.payload } };

    case 'UPDATE_WEEKLY_GOALS':
      return { ...state, weeklyGoals: { ...state.weeklyGoals, ...action.payload } };

    case 'SCHEDULE_REVISIONS': {
      const { topicId, chapterId, subject, topicName, chapterName, completedDate } = action.payload;
      const baseDate = parseISO(completedDate);

      // FSRS-inspired adaptive interval computation based on topic mastery
      let accuracy = 70;
      let confidence = 1;
      for (const sub of state.syllabus) {
        for (const ch of sub.chapters) {
          const t = ch.topics.find(x => x.id === topicId);
          if (t) {
            accuracy = t.accuracy;
            confidence = t.confidence;
            break;
          }
        }
      }

      const topicRevisions = state.revisions.filter(r => r.topicId === topicId && r.completedDate);
      const recalls = topicRevisions.length;
      const logs = state.studyLogs.filter(l => l.topicId === topicId);
      const totalHours = logs.reduce((sum, l) => sum + l.duration, 0) / 60;

      // Compute retention strength (0.1 to 5.0)
      const confidenceScale = 0.5 + (confidence / 5) * 1.5;
      const recallBoost = Math.pow(1.5, recalls);
      const accuracyScale = 0.3 + (accuracy / 100) * 1.2;
      const hourBoost = 1.0 + Math.sqrt(totalHours) * 0.3;
      const strength = Math.min(5, Math.max(0.1, confidenceScale * recallBoost * accuracyScale * hourBoost));

      // Base interval in days; grows with strength
      const baseInterval = Math.max(1, Math.round(2 * strength));
      // Multiplier for exponential spacing: strong topics get wider gaps
      const multiplier = Math.max(1.5, Math.min(4, 1.5 + strength * 0.4));

      const intervals = [
        baseInterval,
        Math.round(baseInterval * multiplier),
        Math.round(baseInterval * multiplier * multiplier),
        strength > 2.5 ? Math.round(baseInterval * multiplier * multiplier * multiplier) : -1,
      ].filter(i => i > 0);

      const newRevisions: RevisionItem[] = intervals.map((days, i) => ({
        id: uuidv4(),
        topicId,
        chapterId,
        subject,
        topicName,
        chapterName,
        dueDate: format(addDays(baseDate, days), 'yyyy-MM-dd'),
        completedDate: null,
        revisionNumber: i + 1,
        easeFactor: 2.5,
        intervalDays: days,
        repetitions: 0,
      }));

      const filtered = state.revisions.filter(
        r => !(r.topicId === topicId && r.completedDate === null)
      );
      return { ...state, revisions: [...filtered, ...newRevisions] };
    }

    case 'ADD_MISTAKE':
      return { ...state, mistakes: [action.payload, ...(state.mistakes || [])] };
      
    case 'RESOLVE_MISTAKE':
      return {
        ...state,
        mistakes: (state.mistakes || []).map(m =>
          m.id === action.payload.mistakeId ? { ...m, status: 'resolved' as const } : m
        )
      };

    case 'ADD_FLASHCARD':
      return { ...state, flashcards: [action.payload, ...(state.flashcards || [])] };

    case 'DELETE_FLASHCARD':
      return { ...state, flashcards: (state.flashcards || []).filter(f => f.id !== action.payload) };

    case 'REVIEW_FLASHCARD': {
      // SM-2 algorithm
      const ratingMap: Record<string, number> = { again: 0, hard: 1, good: 3, easy: 5 };
      const q = ratingMap[action.payload.rating] ?? 3;
      const now = new Date().toISOString();
      return {
        ...state,
        flashcards: (state.flashcards || []).map(fc => {
          if (fc.id !== action.payload.id) return fc;
          let { easeFactor, intervalDays, repetitions } = fc;
          if (q < 3) {
            repetitions = 0;
            intervalDays = 1;
          } else {
            if (repetitions === 0) intervalDays = 1;
            else if (repetitions === 1) intervalDays = 6;
            else intervalDays = Math.round(intervalDays * easeFactor);
            repetitions += 1;
          }
          easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
          const nextReviewAt = format(addDays(new Date(), intervalDays), 'yyyy-MM-dd');
          return { ...fc, easeFactor, intervalDays, repetitions, lastReviewedAt: now, nextReviewAt };
        }),
      };
    }

    case 'TOGGLE_FLASHCARD_PIN':
      return {
        ...state,
        flashcards: (state.flashcards || []).map(fc =>
          fc.id === action.payload ? { ...fc, isPinned: !fc.isPinned } : fc
        ),
      };

    case 'ADD_FORMULA_CARD':
      return { ...state, formulaCards: [action.payload, ...(state.formulaCards || [])] };

    case 'DELETE_FORMULA_CARD':
      return { ...state, formulaCards: (state.formulaCards || []).filter(f => f.id !== action.payload) };

    case 'TOGGLE_FORMULA_PIN':
      return {
        ...state,
        formulaCards: (state.formulaCards || []).map(fc =>
          fc.id === action.payload ? { ...fc, isPinned: !fc.isPinned } : fc
        ),
      };

    case 'TOGGLE_HIDDEN_SUBJECT':
      return {
        ...state,
        hiddenSubjects: state.hiddenSubjects.includes(action.payload)
          ? state.hiddenSubjects.filter(s => s !== action.payload)
          : [...state.hiddenSubjects, action.payload],
      };

    case 'TOGGLE_HIDDEN_CHAPTER':
      return {
        ...state,
        hiddenChapters: state.hiddenChapters.includes(action.payload)
          ? state.hiddenChapters.filter(c => c !== action.payload)
          : [...state.hiddenChapters, action.payload],
      };

    default:
      return state;
  }
}

// Context
interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // Helper functions
  getTopicById: (topicId: string) => { topic: any; chapter: any; subject: any } | null;
  getSubjectStats: (subjectId: SubjectId) => { total: number; completed: number; mastered: number; avgConfidence: number; avgAccuracy: number };
  getReadinessScore: (subjectId: SubjectId) => number;
  getOverallReadiness: () => number;
  getTodayStudyHours: () => number;
  getPendingRevisions: () => RevisionItem[];
  getOverdueRevisions: () => RevisionItem[];
  getTodaysRevisions: () => RevisionItem[];
  getWeakTopics: (limit?: number) => { topicId: string; topicName: string; chapterName: string; subject: SubjectId; accuracy: number; confidence: number }[];
  getStrongTopics: (limit?: number) => { topicId: string; topicName: string; chapterName: string; subject: SubjectId; accuracy: number; confidence: number }[];
  generateDailyPlan: () => DailyPlan;
  generateInsights: () => CoachInsight[];
  updateStreaks: () => void;
  logStudy: (description: string, topicId: string, chapterId: string, subject: SubjectId, duration: number, type: StudyLog['type'], qualityScore?: number, sleepHours?: number, distractions?: number) => void;
  completeTopicWithRevisions: (topicId: string, chapterId: string, subject: SubjectId, topicName: string, chapterName: string) => void;
  getExpectedJEEPerformance: () => {
    expectedScore: number;
    variance: number;
    percentile: number;
    targetDiff: string;
    targetStatus: string;
    bestCase: { score: number; percentile: number };
    likelyCase: { score: number; percentile: number };
    worstCase: { score: number; percentile: number };
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  getStudyTimeEfficiency: () => {
    subject: SubjectId;
    studyHours: number;
    readiness: number;
    marksPerHour: number;
    marksYield: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    label: string;
  }[];
  getWhatToStudyNext: () => { priority: number; topicId: string; topicName: string; chapterName: string; subject: SubjectId; reason: string; action: 'study' | 'practice' | 'revise' }[];
  getTopicForgettingProbability: (topicId: string) => number;
  getBurnoutTelemetry: () => { score: number; status: 'healthy' | 'warning' | 'burnout'; message: string; sleepAverage: number; hoursAverage: number; streak: number };
  getRankTrajectories: () => { current: number[]; optimal: number[]; corrected: number[]; degrading: number[]; labels: string[] };
  getDailyROIEngineTasks: () => { topicId: string; topicName: string; chapterName: string; subject: SubjectId; expectedGain: number; duration: number; action: string }[];
  getExamSimulationBreakdown: () => { safe: number; moderate: number; avoid: number };
  getPrerequisiteGaps: () => { topicId: string; topicName: string; dependentId: string; dependentName: string; reason: string }[];
  getMistakeReplayQuestions: (count?: number) => MistakeEvent[];
  getInsightCalibration: () => { totalInsights: number; dismissedInsights: number; verifiedImprovements: number; calibrationRate: number };
  toggleTopicExclusion: (topicId: string) => void;
  addResource: (resource: StudyResource) => void;
  removeResource: (id: string) => void;
  toggleHiddenSubject: (subjectId: SubjectId) => void;
  toggleHiddenChapter: (chapterId: string) => void;
  isItemHidden: (subjectId: SubjectId, chapterId?: string) => boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const userIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);
  const loadedRef = useRef(false);

  // Load from localStorage + Supabase on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const loadState = async () => {
      // Init Supabase session
      const uid = await initSession();
      userIdRef.current = uid;

      // Load from localStorage
      let localState: AppState | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          localState = {
            ...initialState,
            ...parsed,
            syllabus: parsed.syllabus?.length ? parsed.syllabus : initialState.syllabus,
            achievements: parsed.achievements?.length ? parsed.achievements : initialState.achievements,
            profile: { ...initialState.profile, ...parsed.profile },
            streaks: { ...initialState.streaks, ...parsed.streaks },
            weeklyGoals: { ...initialState.weeklyGoals, ...parsed.weeklyGoals },
            topicEvents: parsed.topicEvents || [],
            mistakes: parsed.mistakes || [],
            flashcards: parsed.flashcards || [],
            formulaCards: parsed.formulaCards || [],
            activeTest: parsed.activeTest || null,
          };
        }
      } catch (e) {
        console.error('Failed to load state from localStorage:', e);
      }

      // Load from Supabase if session available
      if (uid) {
        try {
          const [supabaseLogs, supabaseRevisions, supabaseTests, supabaseTopicStatus, supabaseProfile, supabaseMistakes] = await Promise.all([
            loadStudyLogs(uid),
            loadRevisions(uid),
            loadTestAttempts(uid),
            loadUserTopicStatus(uid),
            loadProfile(uid),
            loadMistakes(uid),
          ]);

          const merged = localState ? { ...localState } : { ...initialState };

          if (supabaseProfile) {
            // Merge profile, preferring local values for fields that are set
            merged.profile = {
              ...supabaseProfile,
              ...merged.profile,
              name: merged.profile.name || supabaseProfile.name || '',
            };
          }

          if (supabaseLogs.length > 0) {
            const localIds = new Set(merged.studyLogs.map(l => l.id));
            const newLogs = supabaseLogs.filter(l => !localIds.has(l.id));
            merged.studyLogs = [...merged.studyLogs, ...newLogs];
          }

          if (supabaseRevisions.length > 0) {
            const localKeys = new Set(merged.revisions.map(r => `${r.topicId}-${r.revisionNumber}`));
            const newRevisions = supabaseRevisions.filter(r => !localKeys.has(`${r.topicId}-${r.revisionNumber}`));
            merged.revisions = [...merged.revisions, ...newRevisions];
          }

          if (supabaseTests.length > 0) {
            const localTestIds = new Set(merged.testAttempts.map(t => t.id));
            const newTests = supabaseTests.filter(t => !localTestIds.has(t.id));
            merged.testAttempts = [...merged.testAttempts, ...newTests];
          }

          if (supabaseMistakes && supabaseMistakes.length > 0) {
            const localMistakeIds = new Set(merged.mistakes.map(m => m.id));
            const newMistakes = supabaseMistakes.filter(m => !localMistakeIds.has(m.id));
            merged.mistakes = [...merged.mistakes, ...newMistakes];
          }

          if (supabaseTopicStatus.length > 0 && !localState) {
            const statusMap = new Map(supabaseTopicStatus.map(s => [s.topic_id, s]));
            merged.syllabus = merged.syllabus.map(sub => ({
              ...sub,
              chapters: sub.chapters.map(ch => ({
                ...ch,
                topics: ch.topics.map(t => {
                  const remote = statusMap.get(t.id);
                  if (remote) {
                    return {
                      ...t,
                      status: remote.status as TopicStatus,
                      confidence: remote.confidence,
                      accuracy: remote.accuracy,
                    };
                  }
                  return t;
                }),
              })),
            }));
          }

          loadedRef.current = true;
          dispatch({ type: 'SET_STATE', payload: merged });
          return;
        } catch (e) {
          console.error('Failed to load state from Supabase:', e);
        }
      }

      // Fallback to localStorage only (or initial state)
      if (localState) {
        dispatch({ type: 'SET_STATE', payload: localState });
      } else {
        // First visit — save initial state to localStorage as baseline
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      }

      loadedRef.current = true;
    };

    loadState();
  }, []);

  // Save to localStorage on state change (only after initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      const serialized = JSON.stringify(state);
      if (serialized.length > 3_500_000) {
        console.warn('State is large (' + (serialized.length / 1024 / 1024).toFixed(1) + 'MB), trimming before save');
        const trimmed = {
          ...state,
          resources: state.resources.slice(0, 20),
          studyLogs: state.studyLogs.slice(-200),
          revisions: state.revisions.slice(-100),
          testAttempts: state.testAttempts.slice(-50),
          mistakes: state.mistakes.slice(-100),
          auditLog: state.auditLog.slice(-100),
          dailyPlans: state.dailyPlans.slice(-30),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.error('Failed to save state:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        try {
          const trimmed = {
            ...state,
            resources: state.resources.slice(0, 10),
            studyLogs: state.studyLogs.slice(-100),
            revisions: state.revisions.slice(-50),
            testAttempts: state.testAttempts.slice(-25),
            mistakes: state.mistakes.slice(-50),
            auditLog: state.auditLog.slice(-50),
            dailyPlans: state.dailyPlans.slice(-14),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch (e2) {
          console.error('Failed to save even trimmed state:', e2);
        }
      }
    }
  }, [state]);

  // Debounced sync to Supabase on state change
  useEffect(() => {
    if (!loadedRef.current) return;
    const uid = userIdRef.current;
    if (!uid) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      syncTopicStatus(state.syllabus, uid);
      syncStudyLogs(state.studyLogs, uid);
      syncRevisions(state.revisions, uid);
      syncTestAttempts(state.testAttempts, uid);
      syncProfile(state.profile, uid);
      syncMistakes(state.mistakes, uid);
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state]);

  const getTopicById = useCallback((topicId: string) => {
    for (const subject of state.syllabus) {
      for (const chapter of subject.chapters) {
        const topic = chapter.topics.find(t => t.id === topicId);
        if (topic) return { topic, chapter, subject };
      }
    }
    return null;
  }, [state.syllabus]);

  const isItemHidden = useCallback((subjectId: SubjectId, chapterId?: string) => {
    if (state.hiddenSubjects.includes(subjectId)) return true;
    if (chapterId && state.hiddenChapters.includes(chapterId)) return true;
    return false;
  }, [state.hiddenSubjects, state.hiddenChapters]);

  const getSubjectStats = useCallback((subjectId: SubjectId) => {
    const subject = state.syllabus.find(s => s.id === subjectId);
    if (!subject || state.hiddenSubjects.includes(subjectId)) return { total: 0, completed: 0, mastered: 0, avgConfidence: 0, avgAccuracy: 0 };

    let total = 0, completed = 0, mastered = 0, totalConfidence = 0, totalAccuracy = 0, ratedCount = 0;
    for (const ch of subject.chapters) {
      if (state.hiddenChapters.includes(ch.id)) continue;
      for (const t of ch.topics) {
        if (t.excluded) continue;
        total++;
        if (t.status === 'completed' || t.status === 'revised' || t.status === 'mastered') completed++;
        if (t.status === 'mastered') mastered++;
        if (t.confidence > 0) { totalConfidence += t.confidence; ratedCount++; }
        if (t.accuracy > 0) totalAccuracy += t.accuracy;
      }
    }
    return {
      total,
      completed,
      mastered,
      avgConfidence: ratedCount > 0 ? totalConfidence / ratedCount : 0,
      avgAccuracy: ratedCount > 0 ? totalAccuracy / ratedCount : 0,
    };
  }, [state.syllabus, state.hiddenSubjects, state.hiddenChapters]);

  const getReadinessScore = useCallback((subjectId: SubjectId) => {
    const stats = getSubjectStats(subjectId);
    if (stats.total === 0) return 0;

    const completionScore = (stats.completed / stats.total) * 100;
    const confidenceScore = (stats.avgConfidence / 5) * 100;

    // Test accuracy for this subject
    const subjectTests = state.testAttempts.filter(t =>
      t.subjectBreakdown.some(s => s.subject === subjectId)
    );
    let testAccuracy = 0;
    if (subjectTests.length > 0) {
      const totalCorrect = subjectTests.reduce((sum, t) => {
        const sb = t.subjectBreakdown.find(s => s.subject === subjectId);
        return sum + (sb?.correct ?? 0);
      }, 0);
      const totalQ = subjectTests.reduce((sum, t) => {
        const sb = t.subjectBreakdown.find(s => s.subject === subjectId);
        return sum + (sb?.total ?? 0);
      }, 0);
      testAccuracy = totalQ > 0 ? (totalCorrect / totalQ) * 100 : 0;
    }

    // Revision consistency
    const subjectRevisions = state.revisions.filter(r => r.subject === subjectId);
    const completedRevisions = subjectRevisions.filter(r => r.completedDate);
    const revisionConsistency = subjectRevisions.length > 0
      ? (completedRevisions.length / subjectRevisions.length) * 100
      : 0;

    // Weighted score
    const readiness = (
      completionScore * 0.30 +
      confidenceScore * 0.20 +
      testAccuracy * 0.25 +
      revisionConsistency * 0.15 +
      (stats.mastered / Math.max(stats.total, 1)) * 100 * 0.10
    );

    return Math.round(Math.min(readiness, 100));
  }, [getSubjectStats, state.testAttempts, state.revisions]);

  const getOverallReadiness = useCallback(() => {
    const p = getReadinessScore('physics');
    const c = getReadinessScore('chemistry');
    const m = getReadinessScore('mathematics');
    return Math.round((p + c + m) / 3);
  }, [getReadinessScore]);

  const getTodayStudyHours = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = state.studyLogs.filter(l => l.date.startsWith(today));
    return todayLogs.reduce((sum, l) => sum + l.duration, 0) / 60;
  }, [state.studyLogs]);

  const getPendingRevisions = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return state.revisions.filter(r => !r.completedDate && r.dueDate <= today);
  }, [state.revisions]);

  const getOverdueRevisions = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return state.revisions.filter(r => !r.completedDate && r.dueDate < today);
  }, [state.revisions]);

  const getTodaysRevisions = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return state.revisions.filter(r => !r.completedDate && r.dueDate === today);
  }, [state.revisions]);

  const getWeakTopics = useCallback((limit = 10) => {
    const topics: { topicId: string; topicName: string; chapterName: string; subject: SubjectId; accuracy: number; confidence: number }[] = [];
    for (const subject of state.syllabus) {
      if (state.hiddenSubjects.includes(subject.id)) continue;
      for (const chapter of subject.chapters) {
        if (state.hiddenChapters.includes(chapter.id)) continue;
        for (const topic of chapter.topics) {
          if (topic.excluded) continue;
          if (topic.status !== 'not_started' && (topic.accuracy < 60 || topic.confidence < 3)) {
            topics.push({
              topicId: topic.id,
              topicName: topic.name,
              chapterName: chapter.name,
              subject: subject.id,
              accuracy: topic.accuracy,
              confidence: topic.confidence,
            });
          }
        }
      }
    }
    return topics.sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
  }, [state.syllabus, state.hiddenSubjects, state.hiddenChapters]);

  const getStrongTopics = useCallback((limit = 10) => {
    const topics: { topicId: string; topicName: string; chapterName: string; subject: SubjectId; accuracy: number; confidence: number }[] = [];
    for (const subject of state.syllabus) {
      if (state.hiddenSubjects.includes(subject.id)) continue;
      for (const chapter of subject.chapters) {
        if (state.hiddenChapters.includes(chapter.id)) continue;
        for (const topic of chapter.topics) {
          if (topic.excluded) continue;
          if (topic.accuracy >= 80 && topic.confidence >= 4) {
            topics.push({
              topicId: topic.id,
              topicName: topic.name,
              chapterName: chapter.name,
              subject: subject.id,
              accuracy: topic.accuracy,
              confidence: topic.confidence,
            });
          }
        }
      }
    }
    return topics.sort((a, b) => b.accuracy - a.accuracy).slice(0, limit);
  }, [state.syllabus, state.hiddenSubjects, state.hiddenChapters]);

  const generateDailyPlan = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tasks: PlanTask[] = [];

    // Add revision tasks first (high priority)
    const pendingRevisions = getPendingRevisions();
    pendingRevisions.slice(0, 3).forEach((rev, i) => {
      tasks.push({
        id: uuidv4(),
        time: `${16 + i}:00`,
        title: `Revise: ${rev.topicName}`,
        description: `Revision #${rev.revisionNumber} for ${rev.chapterName}`,
        type: 'revision',
        duration: 30,
        completed: false,
        topicId: rev.topicId,
        subject: rev.subject,
      });
    });

    // Add weak topic practice
    const weakTopics = getWeakTopics(3);
    weakTopics.forEach((wt, i) => {
      tasks.push({
        id: uuidv4(),
        time: `${17 + pendingRevisions.length + i}:00`,
        title: `Practice: ${wt.topicName}`,
        description: `Focus on improving accuracy in ${wt.chapterName}`,
        type: 'practice',
        duration: 45,
        completed: false,
        topicId: wt.topicId,
        subject: wt.subject,
      });
    });

    // Add study tasks for incomplete topics
    const incompletTopics: { topicId: string; topicName: string; chapterName: string; subject: SubjectId }[] = [];
    for (const subject of state.syllabus) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          if (topic.status === 'not_started' || topic.status === 'learning') {
            incompletTopics.push({ topicId: topic.id, topicName: topic.name, chapterName: chapter.name, subject: subject.id });
          }
        }
      }
    }

    incompletTopics.slice(0, 2).forEach((t, i) => {
      tasks.push({
        id: uuidv4(),
        time: `${19 + i}:00`,
        title: `Study: ${t.topicName}`,
        description: `Continue learning ${t.chapterName}`,
        type: 'study',
        duration: 60,
        completed: false,
        topicId: t.topicId,
        subject: t.subject,
      });
    });

    // Add a test task
    if (tasks.length > 0) {
      tasks.push({
        id: uuidv4(),
        time: '21:00',
        title: 'Daily Quiz',
        description: 'Take a mixed practice test',
        type: 'test',
        duration: 30,
        completed: false,
      });
    }

    // Add break
    tasks.push({
      id: uuidv4(),
      time: '20:00',
      title: 'Break',
      description: 'Take a short break',
      type: 'break',
      duration: 15,
      completed: false,
    });

    // Sort by time
    tasks.sort((a, b) => a.time.localeCompare(b.time));

    const plan: DailyPlan = {
      id: uuidv4(),
      date: today,
      tasks,
      completed: false,
    };

    return plan;
  }, [getPendingRevisions, getWeakTopics, state.syllabus]);

  const getTopicForgettingProbability = useCallback((topicId: string) => {
    const now = new Date();
    const info = getTopicById(topicId);
    if (!info || info.topic.status === 'not_started') return 100;
    
    const topic = info.topic;
    const lastDateStr = topic.lastRevision || topic.completedDate || state.studyLogs.filter(l => l.topicId === topicId)[0]?.date;
    if (!lastDateStr) return 50;
    
    const lastDate = parseISO(lastDateStr);
    const daysSince = Math.max(0, differenceInDays(now, lastDate));
    const topicRevisions = state.revisions.filter(r => r.topicId === topicId && r.completedDate);
    const recalls = topicRevisions.length;
    const logs = state.studyLogs.filter(l => l.topicId === topicId);
    const totalMinutes = logs.reduce((sum, l) => sum + l.duration, 0);
    const totalHours = totalMinutes / 60;
    
    const confidence = topic.confidence || 1;
    const accuracy = (topic.accuracy || 50) / 100;
    
    const baseHalflife = 2.0;
    const confidenceScale = 1.0 + confidence * 0.5;
    const recallScale = Math.pow(1.8, recalls);
    const accuracyScale = 0.5 + accuracy;
    const hourScale = 1.0 + Math.sqrt(totalHours);
    
    const strength = baseHalflife * confidenceScale * recallScale * accuracyScale * hourScale;
    const pRemember = Math.exp(-daysSince / strength);
    const pForget = 1.0 - pRemember;
    
    return Math.round(pForget * 100);
  }, [state.revisions, state.studyLogs, getTopicById]);

  const generateInsights = useCallback((): CoachInsight[] => {
    const insights: CoachInsight[] = [];
    const now = new Date();

    // Check for topics not revised in a long time
    for (const subject of state.syllabus) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          if (topic.completedDate && topic.lastRevision) {
            const daysSinceRevision = differenceInDays(now, parseISO(topic.lastRevision));
            if (daysSinceRevision > 14) {
              insights.push({
                id: uuidv4(),
                date: now.toISOString(),
                type: 'revision_reminder',
                message: `You have not revised "${topic.name}" for ${daysSinceRevision} days. It's from ${chapter.name} (${subject.name}).`,
                priority: daysSinceRevision > 30 ? 'high' : 'medium',
                relatedTopicId: topic.id,
                relatedSubject: subject.id,
                actionable: true,
                dismissed: false,
                evidence: `Topic not revised for ${daysSinceRevision} days. Last revision: ${format(parseISO(topic.lastRevision), 'MMM d, yyyy')}.`,
                confidence: 'high',
                dataPoints: 1,
              });
            }
          }
        }
      }
    }

    // Check accuracy drops
    if (state.testAttempts.length >= 2) {
      for (const subjectId of ['physics', 'chemistry', 'mathematics'] as SubjectId[]) {
        const recent = state.testAttempts.slice(0, 5).filter(t => t.subjectBreakdown.some(s => s.subject === subjectId));
        const older = state.testAttempts.slice(5, 10).filter(t => t.subjectBreakdown.some(s => s.subject === subjectId));
        if (recent.length > 0 && older.length > 0) {
          const recentAcc = recent.reduce((sum, t) => {
            const sb = t.subjectBreakdown.find(s => s.subject === subjectId);
            return sb ? sum + (sb.correct / Math.max(sb.total, 1)) : sum;
          }, 0) / recent.length * 100;
          const olderAcc = older.reduce((sum, t) => {
            const sb = t.subjectBreakdown.find(s => s.subject === subjectId);
            return sb ? sum + (sb.correct / Math.max(sb.total, 1)) : sum;
          }, 0) / older.length * 100;
          if (olderAcc - recentAcc > 10) {
            insights.push({
              id: uuidv4(),
              date: now.toISOString(),
              type: 'accuracy_drop',
              message: `Your ${subjectId} accuracy has dropped from ${Math.round(olderAcc)}% to ${Math.round(recentAcc)}%. Review your recent mistakes.`,
              priority: 'high',
              relatedSubject: subjectId,
              actionable: true,
              dismissed: false,
              evidence: `Subject accuracy dropped from ${Math.round(olderAcc)}% to ${Math.round(recentAcc)}% across ${recent.length + older.length} tests.`,
              confidence: recent.length + older.length >= 4 ? 'high' : 'medium',
              dataPoints: recent.length + older.length,
            });
          }
        }
      }
    }

    // Priority suggestions based on weak topics
    const weakTopics = getWeakTopics(3);
    if (weakTopics.length > 0) {
      insights.push({
        id: uuidv4(),
        date: now.toISOString(),
        type: 'priority_suggestion',
        message: `Today's highest priority should be "${weakTopics[0].topicName}" revision. Your accuracy is only ${weakTopics[0].accuracy}%.`,
        priority: 'high',
        relatedTopicId: weakTopics[0].topicId,
        relatedSubject: weakTopics[0].subject,
        actionable: true,
        dismissed: false,
        evidence: `Weak topic identified. Past accuracy: ${weakTopics[0].accuracy}%. Confidence: ${weakTopics[0].confidence}/5.`,
        confidence: weakTopics[0].confidence >= 4 ? 'high' : 'medium',
        dataPoints: 3,
      });
    }

    // Error pattern analysis
    const allErrors = state.testAttempts.flatMap(t => t.errors);
    if (allErrors.length >= 5) {
      const errorCounts: Record<string, number> = {};
      allErrors.forEach(e => { errorCounts[e.errorType] = (errorCounts[e.errorType] || 0) + 1; });
      const topError = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0];
      if (topError) {
        const errorLabels: Record<string, string> = {
          concept_gap: 'concept gaps',
          formula_forgotten: 'forgotten formulas',
          calculation_mistake: 'calculation mistakes',
          time_pressure: 'time pressure',
          misread_question: 'misread questions',
          guessing_error: 'guessing errors',
        };
        insights.push({
          id: uuidv4(),
          date: now.toISOString(),
          type: 'study_pattern',
          message: `Most of your test mistakes (${topError[1]} times) are due to ${errorLabels[topError[0]] || topError[0]}. Focus on addressing this pattern.`,
          priority: 'medium',
          actionable: true,
          dismissed: false,
          evidence: `Identified ${topError[1]} mistakes of type "${topError[0]}" out of ${allErrors.length} total mistakes.`,
          confidence: allErrors.length >= 8 ? 'high' : 'medium',
          dataPoints: allErrors.length,
        });
      }
    }

    // Study consistency
    const todayHours = getTodayStudyHours();
    if (todayHours === 0 && now.getHours() >= 16) {
      insights.push({
        id: uuidv4(),
        date: now.toISOString(),
        type: 'study_pattern',
        message: `You haven't logged any study time today. It's ${format(now, 'h:mm a')} — start now to maintain your streak!`,
        priority: 'high',
        actionable: true,
        dismissed: false,
        evidence: `No study session logged as of ${format(now, 'h:mm a')}. Daily target is ${state.profile.studyHoursPerDay} hours.`,
        confidence: 'high',
        dataPoints: state.studyLogs.length,
      });
    }

    // Overdue revisions
    const overdue = getOverdueRevisions();
    if (overdue.length > 0) {
      insights.push({
        id: uuidv4(),
        date: now.toISOString(),
        type: 'revision_reminder',
        message: `You have ${overdue.length} overdue revision${overdue.length > 1 ? 's' : ''}. Clear your revision debt to maintain long-term retention.`,
        priority: 'high',
        actionable: true,
        dismissed: false,
        evidence: `${overdue.length} revisions are past their scheduled dates.`,
        confidence: 'high',
        dataPoints: overdue.length,
      });
    }

    // Forgetting probability alerts
    for (const sub of state.syllabus) {
      for (const ch of sub.chapters) {
        for (const t of ch.topics) {
          if (t.status === 'not_started' || t.status === 'learning') continue;
          const forgetProb = getTopicForgettingProbability(t.id);
          if (forgetProb > 70) {
            insights.push({
              id: uuidv4(),
              date: now.toISOString(),
              type: 'forgetting_alert',
              message: `⚠️ ${t.name}: ${forgetProb}% forgetting probability. Urgent revision needed to prevent knowledge decay.`,
              priority: forgetProb > 85 ? 'high' : 'medium',
              relatedTopicId: t.id,
              relatedSubject: sub.id,
              actionable: true,
              dismissed: false,
              evidence: `Forgetting model: ${forgetProb}% decay since last revision. Based on ${state.revisions.filter(r => r.topicId === t.id && r.completedDate).length} completed revisions and ${state.studyLogs.filter(l => l.topicId === t.id).length} study sessions.`,
              confidence: state.revisions.filter(r => r.topicId === t.id && r.completedDate).length >= 2 ? 'high' : 'medium',
              dataPoints: state.revisions.filter(r => r.topicId === t.id).length + state.studyLogs.filter(l => l.topicId === t.id).length,
            });
          }
        }
      }
    }

    return insights;
  }, [state.syllabus, state.testAttempts, getWeakTopics, getTodayStudyHours, getOverdueRevisions, getTopicForgettingProbability, state.revisions, state.studyLogs, state.profile.studyHoursPerDay]);

  const updateStreaks = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');

    // Study streak
    const todayLogs = state.studyLogs.filter(l => l.date.startsWith(today));
    if (todayLogs.length > 0) {
      const lastDate = state.streaks.lastStudyDate;
      let newStreak = state.streaks.currentStudy;
      if (lastDate === yesterday || lastDate === today) {
        if (lastDate !== today) newStreak++;
      } else {
        newStreak = 1;
      }
      dispatch({
        type: 'UPDATE_STREAKS',
        payload: {
          currentStudy: newStreak,
          longestStudy: Math.max(newStreak, state.streaks.longestStudy),
          lastStudyDate: today,
        },
      });
    }
  }, [state.studyLogs, state.streaks, dispatch]);

  const logStudy = useCallback((
    description: string, 
    topicId: string, 
    chapterId: string, 
    subject: SubjectId, 
    duration: number, 
    type: StudyLog['type'],
    qualityScore?: number,
    sleepHours?: number,
    distractions?: number
  ) => {
    let finalQuality = qualityScore;
    if (finalQuality === undefined) {
      let score = 100;
      const sleep = sleepHours ?? 7;
      const dist = distractions ?? 0;
      
      if (sleep < 6) score -= 15;
      if (sleep < 5) score -= 15;
      
      score -= dist * 10;
      
      if (duration < 30) score -= 10;
      if (duration > 180) score -= 15;
      
      finalQuality = Math.max(10, Math.min(100, score));
    }

    const log: StudyLog = {
      id: uuidv4(),
      date: new Date().toISOString(),
      description,
      topicId,
      chapterId,
      subject,
      duration,
      type,
      qualityScore: finalQuality,
      sleepHours: sleepHours ?? 7,
      distractions: distractions ?? 0,
    };
    dispatch({ type: 'ADD_STUDY_LOG', payload: log });

    // Update topic status if studying
    if (type === 'study') {
      const info = getTopicById(topicId);
      if (info && info.topic.status === 'not_started') {
        dispatch({ type: 'UPDATE_TOPIC_STATUS', payload: { topicId, status: 'learning' } });
      }
    }
  }, [dispatch, getTopicById]);

  const completeTopicWithRevisions = useCallback((topicId: string, chapterId: string, subject: SubjectId, topicName: string, chapterName: string, status: TopicStatus = 'completed') => {
    const now = new Date().toISOString();
    dispatch({ type: 'UPDATE_TOPIC_STATUS', payload: { topicId, status, source: 'manual' } });
    if (status === 'completed' || status === 'revised' || status === 'mastered') {
      dispatch({
        type: 'SCHEDULE_REVISIONS',
        payload: { topicId, chapterId, subject, topicName, chapterName, completedDate: now },
      });
    }
  }, [dispatch]);

  const getExpectedJEEPerformance = useCallback(() => {
    const readiness = getOverallReadiness();
    
    let testAvgPercentage = 45; // default starting baseline (135/300)
    if (state.testAttempts.length > 0) {
      const sum = state.testAttempts.reduce((acc, t) => acc + (t.score / Math.max(t.maxScore, 1)), 0);
      testAvgPercentage = (sum / state.testAttempts.length) * 100;
    }
    
    // Weighted score: 40% readiness + 60% mock test history
    const finalPercentage = state.testAttempts.length > 0 
      ? (readiness * 0.4 + testAvgPercentage * 0.6) 
      : readiness;
    
    let expectedScore = Math.round((finalPercentage / 100) * 300);
    expectedScore = Math.max(0, Math.min(300, expectedScore));
    
    // Variance decreases with number of test attempts (min ±8)
    const testCount = state.testAttempts.length;
    const variance = Math.max(8, Math.round(15 - testCount * 0.5));
    
    // Smooth lookup score-to-percentile curve based on typical JEE statistics
    const scoreToPercentile = (s: number) => {
      const curve = [
        { s: 300, p: 100 },
        { s: 270, p: 99.95 },
        { s: 250, p: 99.9 },
        { s: 220, p: 99.7 },
        { s: 200, p: 99.4 },
        { s: 180, p: 98.2 },
        { s: 160, p: 97.4 },
        { s: 140, p: 96.0 },
        { s: 120, p: 94.0 },
        { s: 100, p: 91.0 },
        { s: 80, p: 85.0 },
        { s: 60, p: 75.0 },
        { s: 40, p: 58.0 },
        { s: 20, p: 30.0 },
        { s: 0, p: 0 }
      ];
      if (s >= 300) return 100;
      if (s <= 0) return 0;
      for (let i = 0; i < curve.length - 1; i++) {
        const high = curve[i];
        const low = curve[i+1];
        if (s <= high.s && s >= low.s) {
          const ratio = (s - low.s) / (high.s - low.s);
          return low.p + ratio * (high.p - low.p);
        }
      }
      return 0;
    };
    
    const percentile = Math.round(scoreToPercentile(expectedScore) * 10) / 10;
    
    // Target CSE NIT Trichy: Cutoff is roughly 99.8% or ~240 marks
    const targetScore = 240;
    const diff = targetScore - expectedScore;
    const targetStatus = diff <= 0 ? 'Target Met!' : 'Target Pending';
    const targetDiff = diff <= 0 ? 'cse_met' : `Need +${diff} marks`;
    
    return {
      expectedScore,
      variance,
      percentile,
      targetDiff,
      targetStatus,
      bestCase: { score: Math.min(300, expectedScore + variance), percentile: Math.round(scoreToPercentile(Math.min(300, expectedScore + variance)) * 10) / 10 },
      likelyCase: { score: expectedScore, percentile },
      worstCase: { score: Math.max(0, expectedScore - variance), percentile: Math.round(scoreToPercentile(Math.max(0, expectedScore - variance)) * 10) / 10 },
      confidenceLevel: (testCount >= 5 ? 'high' : testCount >= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    };
  }, [state.testAttempts, getOverallReadiness]);

  const getStudyTimeEfficiency = useCallback(() => {
    return (['physics', 'chemistry', 'mathematics'] as SubjectId[]).map(subId => {
      const subjectLogs = state.studyLogs.filter(l => l.subject === subId);
      const studyMinutes = subjectLogs.reduce((sum, l) => sum + l.duration, 0);
      const studyHours = Math.round((studyMinutes / 60) * 10) / 10;
      const readiness = getReadinessScore(subId);
      
      // Calculate marks improvement: (current readiness - baseline) / hours
      const baseline = 20;
      const improvement = Math.max(0, readiness - baseline);
      const marksYield = studyHours > 0 
        ? Math.round((improvement / studyHours) * 100) / 100
        : 0;
      
      // Calculate trend (last 7 days vs prior 7 days)
      const now = new Date();
      const recentLogs = subjectLogs.filter(l => {
        try {
          const dStr = l.date.includes('T') ? l.date : `${l.date}T00:00:00.000Z`;
          const diff = (now.getTime() - new Date(dStr).getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 7;
        } catch {
          return false;
        }
      });
      const olderLogs = subjectLogs.filter(l => {
        try {
          const dStr = l.date.includes('T') ? l.date : `${l.date}T00:00:00.000Z`;
          const diff = (now.getTime() - new Date(dStr).getTime()) / (1000 * 60 * 60 * 24);
          return diff > 7 && diff <= 14;
        } catch {
          return false;
        }
      });
      const recentHours = recentLogs.reduce((sum, l) => sum + l.duration, 0) / 60;
      const olderHours = olderLogs.reduce((sum, l) => sum + l.duration, 0) / 60;
      const trend: 'increasing' | 'decreasing' | 'stable' = recentHours > olderHours ? 'increasing' : recentHours < olderHours ? 'decreasing' : 'stable';
      
      return {
        subject: subId,
        studyHours,
        readiness,
        marksPerHour: marksYield,
        marksYield,
        trend,
        label: `${marksYield.toFixed(1)} marks improvement per hour`,
      };
    });
  }, [state.studyLogs, getReadinessScore]);

  const getWhatToStudyNext = useCallback(() => {
    const priorities: {
      priority: number;
      topicId: string;
      topicName: string;
      chapterName: string;
      subject: SubjectId;
      reason: string;
      action: 'study' | 'practice' | 'revise';
    }[] = [];
    
    // Priority 1: Check overdue/pending revisions
    const pendingRevisions = getPendingRevisions();
    if (pendingRevisions.length > 0) {
      const rev = pendingRevisions[0];
      priorities.push({
        priority: 1,
        topicId: rev.topicId,
        topicName: rev.topicName,
        chapterName: rev.chapterName,
        subject: rev.subject,
        reason: `Revision #${rev.revisionNumber} is overdue (Forgetting Curve Alert)`,
        action: 'revise',
      });
    } else {
      const weakTopics = getWeakTopics(1);
      if (weakTopics.length > 0) {
        const wt = weakTopics[0];
        priorities.push({
          priority: 1,
          topicId: wt.topicId,
          topicName: wt.topicName,
          chapterName: wt.chapterName,
          subject: wt.subject,
          reason: `Accuracy is low (${wt.accuracy}%). Revise core concepts.`,
          action: 'revise',
        });
      }
    }
    
    // Priority 2: Weakest topic needing practice/retake
    const weakTopics = getWeakTopics(5);
    const availableWeak = weakTopics.filter(wt => !priorities.some(p => p.topicId === wt.topicId));
    if (availableWeak.length > 0) {
      const wt = availableWeak[0];
      priorities.push({
        priority: 2,
        topicId: wt.topicId,
        topicName: wt.topicName,
        chapterName: wt.chapterName,
        subject: wt.subject,
        reason: `Weak performance in past reviews. Focus on practice questions.`,
        action: 'practice',
      });
    } else {
      // Find a topic currently being learned
      let learningTopic: any = null;
      for (const sub of state.syllabus) {
        for (const ch of sub.chapters) {
          const t = ch.topics.find(x => x.status === 'learning');
          if (t && !priorities.some(p => p.topicId === t.id)) {
            learningTopic = { topic: t, chapterName: ch.name, subject: sub.id };
            break;
          }
        }
        if (learningTopic) break;
      }
      
      if (learningTopic) {
        priorities.push({
          priority: 2,
          topicId: learningTopic.topic.id,
          topicName: learningTopic.topic.name,
          chapterName: learningTopic.chapterName,
          subject: learningTopic.subject,
          reason: `Continue active study and complete subject notes.`,
          action: 'study',
        });
      }
    }
    
    // Priority 3: Unstarted core topic in the syllabus order
    let nextTopic: any = null;
    for (const sub of state.syllabus) {
      for (const ch of sub.chapters) {
        const t = ch.topics.find(x => x.status === 'not_started');
        if (t && !priorities.some(p => p.topicId === t.id)) {
          nextTopic = { topic: t, chapterName: ch.name, subject: sub.id };
          break;
        }
      }
      if (nextTopic) break;
    }
    
    if (nextTopic) {
      priorities.push({
        priority: 3,
        topicId: nextTopic.topic.id,
        topicName: nextTopic.topic.name,
        chapterName: nextTopic.chapterName,
        subject: nextTopic.subject,
        reason: `Unstudied core syllabus topic. Get started with basic theory.`,
        action: 'study',
      });
    }
    
    return priorities;
  }, [state.syllabus, getPendingRevisions, getWeakTopics]);


  const getBurnoutTelemetry = useCallback(() => {
    const now = new Date();
    const last7DaysLogs = state.studyLogs.filter(l => {
      const logDate = parseISO(l.date);
      return differenceInDays(now, logDate) <= 7;
    });
    
    const totalMinutes = last7DaysLogs.reduce((sum, l) => sum + l.duration, 0);
    const avgDailyHours = (totalMinutes / 7) / 60;
    const sleepLogs = last7DaysLogs.filter(l => l.sleepHours !== undefined);
    const avgSleep = sleepLogs.length > 0 
      ? sleepLogs.reduce((sum, l) => sum + (l.sleepHours || 7), 0) / sleepLogs.length
      : 7.0;
      
    const streak = state.streaks.currentStudy;
    
    let accuracyDropped = false;
    const attempts = state.testAttempts.slice(0, 8);
    if (attempts.length >= 4) {
      const recentAcc = attempts.slice(0, 2).reduce((sum, t) => sum + (t.score / Math.max(t.maxScore, 1)), 0) / 2;
      const olderAcc = attempts.slice(2, 4).reduce((sum, t) => sum + (t.score / Math.max(t.maxScore, 1)), 0) / 2;
      if (olderAcc - recentAcc > 0.1) {
        accuracyDropped = true;
      }
    }
    
    let burnoutScore = 15;
    if (avgDailyHours > 7) burnoutScore += 20;
    if (avgDailyHours > 9) burnoutScore += 20;
    if (avgSleep < 6.5) burnoutScore += 15;
    if (avgSleep < 5.5) burnoutScore += 20;
    if (streak > 10) burnoutScore += 10;
    if (streak > 20) burnoutScore += 10;
    if (accuracyDropped && avgDailyHours > 6) burnoutScore += 20;
    
    burnoutScore = Math.min(100, burnoutScore);
    
    let status: 'healthy' | 'warning' | 'burnout' = 'healthy';
    let message = 'Your fatigue levels are optimal. Maintain this study balance.';
    if (burnoutScore > 45) {
      status = 'warning';
      message = 'Fatigue caution: Sleep average is dropping below 6.5 hours. Schedule a light rest day.';
    }
    if (burnoutScore > 70) {
      status = 'burnout';
      message = 'Burnout alert! Study hours are increasing while quiz accuracy drops. Take 24 hours off immediately to reset.';
    }
    
    return {
      score: burnoutScore,
      status,
      message,
      sleepAverage: Math.round(avgSleep * 10) / 10,
      hoursAverage: Math.round(avgDailyHours * 10) / 10,
      streak,
    };
  }, [state.studyLogs, state.testAttempts, state.streaks]);

  const getRankTrajectories = useCallback(() => {
    const performance = getExpectedJEEPerformance();
    const currentPct = performance.percentile;
    
    const currentPath: number[] = [currentPct];
    const optimalPath: number[] = [currentPct];
    const correctedPath: number[] = [currentPct];
    const degradingPath: number[] = [currentPct];
    
    for (let i = 1; i <= 5; i++) {
      const currentDrift = currentPct + Math.sin(i * 0.5) * 0.1;
      currentPath.push(Math.round(Math.min(99.9, currentDrift) * 100) / 100);
      
      const optimalDrift = currentPct + (i * 0.15) * (1.0 - (currentPct - 90) / 20);
      optimalPath.push(Math.round(Math.min(99.95, optimalDrift) * 100) / 100);
      
      const correctedDrift = currentPct + (i * 0.22) * (1.0 - (currentPct - 90) / 20);
      correctedPath.push(Math.round(Math.min(99.98, correctedDrift) * 100) / 100);
      
      const degradingDrift = currentPct - (i * 0.25);
      degradingPath.push(Math.round(Math.max(10.0, degradingDrift) * 100) / 100);
    }
    
    return {
      current: currentPath,
      optimal: optimalPath,
      corrected: correctedPath,
      degrading: degradingPath,
      labels: ['Start', 'Mock 1', 'Mock 2', 'Mock 3', 'Mock 4', 'Mock 5'],
    };
  }, [getExpectedJEEPerformance]);

  const getDailyROIEngineTasks = useCallback(() => {
    const weightageTable: Record<string, number> = {
      'math-calc-differentiation': 4.0,
      'math-calc-application-diff': 5.0,
      'math-calc-definite': 5.0,
      'math-alg-sets': 3.5,
      'math-alg-matrices': 4.5,
      'math-alg-probability': 4.5,
      'phy-mech-newton': 4.5,
      'phy-mech-rotation': 5.5,
      'phy-elst-field': 5.0,
      'phy-elst-capacitance': 4.0,
      'phy-modern-semiconductor': 4.5,
      'chem-basic-mole': 4.0,
      'chem-equilibrium-ionic': 4.5,
      'chem-organic-basic': 5.0,
      'chem-org-aldehydes': 5.5,
    };

    const priorities: {
      topicId: string;
      topicName: string;
      chapterName: string;
      subject: SubjectId;
      expectedGain: number;
      duration: number;
      action: string;
    }[] = [];
    
    for (const sub of state.syllabus) {
      for (const ch of sub.chapters) {
        for (const t of ch.topics) {
          const baseWeight = weightageTable[ch.id] || 3.0;
          let expectedGain = 1.0;
          let action = 'Study Core Theory';
          let duration = 60;

          if (t.status === 'not_started') {
            expectedGain = baseWeight * 0.6;
            action = 'Build Fundamentals';
            duration = 60;
          } else if (t.status === 'learning' || t.accuracy < 60) {
            expectedGain = baseWeight * 0.8;
            action = 'Solve PYQ Practice';
            duration = 45;
          } else {
            const forgetProb = getTopicForgettingProbability(t.id);
            if (forgetProb > 60) {
              expectedGain = baseWeight * 0.9;
              action = 'Spaced Revision Card';
              duration = 30;
            } else {
              continue;
            }
          }
          
          priorities.push({
            topicId: t.id,
            topicName: t.name,
            chapterName: ch.name,
            subject: sub.id,
            expectedGain: Math.round(expectedGain * 10) / 10,
            duration,
            action,
          });
        }
      }
    }
    
    return priorities.sort((a, b) => b.expectedGain - a.expectedGain).slice(0, 3);
  }, [state.syllabus, getTopicForgettingProbability]);

  const getExamSimulationBreakdown = useCallback(() => {
    let safe = 0;
    let moderate = 0;
    let avoid = 0;
    
    for (const sub of state.syllabus) {
      for (const ch of sub.chapters) {
        for (const t of ch.topics) {
          if (t.status === 'not_started') {
            avoid++;
          } else if (t.accuracy >= 75 && t.confidence >= 4) {
            safe++;
          } else if (t.accuracy < 50) {
            avoid++;
          } else {
            moderate++;
          }
        }
      }
    }
    
    const total = safe + moderate + avoid;
    const scale = 75 / Math.max(1, total);
    
    return {
      safe: Math.max(10, Math.round(safe * scale)),
      moderate: Math.max(10, Math.round(moderate * scale)),
      avoid: Math.max(5, Math.round(avoid * scale)),
    };
  }, [state.syllabus]);

  const getPrerequisiteGaps = useCallback(() => {
    const dependencies = [
      { depId: 'math-calc-differentiability', prereqId: 'math-calc-limits', reason: 'Prerequisite: Differentiability requires complete understanding of Limit convergence.' },
      { depId: 'math-calc-differentiation', prereqId: 'math-calc-differentiability', reason: 'Prerequisite: Differentiation methods build upon Differentiability rules.' },
      { depId: 'math-calc-application-diff', prereqId: 'math-calc-differentiation', reason: 'Prerequisite: Application of Derivatives relies directly on differentiation calculations.' },
      { depId: 'math-calc-definite', prereqId: 'math-calc-indefinite', reason: 'Prerequisite: Definite integrals require mastering antiderivative/indefinite integration.' },
      { depId: 'math-calc-diffeq', prereqId: 'math-calc-differentiation', reason: 'Prerequisite: Differential Equations require calculating Derivatives and Integrals.' },
      { depId: 'phy-mech-motion1d', prereqId: 'phy-mech-units', reason: 'Prerequisite: Kinematics relies on unit analysis and conversions.' },
      { depId: 'phy-mech-motion2d', prereqId: 'phy-mech-motion1d', reason: 'Prerequisite: 2D vectors extend 1D straight-line projectile rules.' },
      { depId: 'phy-mech-newton', prereqId: 'phy-mech-motion2d', reason: 'Prerequisite: Forces and NLM require vector acceleration equations.' },
      { depId: 'phy-mech-workenergy', prereqId: 'phy-mech-newton', reason: 'Prerequisite: Work and Energy equations are derived from force vectors.' },
      { depId: 'phy-mech-rotation', prereqId: 'phy-mech-workenergy', reason: 'Prerequisite: Rotational torque equations extend linear work-energy theorems.' },
      { depId: 'chem-equilibrium-ionic', prereqId: 'chem-basic-mole', reason: 'Prerequisite: Ionic chemical constants build on concentration mole terms.' },
      { depId: 'chem-electrochemistry-cells', prereqId: 'chem-equilibrium-ionic', reason: 'Prerequisite: Nernst potentials are calculated from chemical constants.' },
    ];

    const alerts: {
      topicId: string;
      topicName: string;
      dependentId: string;
      dependentName: string;
      reason: string;
    }[] = [];
    
    dependencies.forEach(dep => {
      const depInfo = getTopicById(dep.depId);
      const preInfo = getTopicById(dep.prereqId);
      
      if (depInfo && preInfo) {
        const depStudied = depInfo.topic.status !== 'not_started';
        const preWeak = preInfo.topic.status === 'not_started' || preInfo.topic.accuracy < 60 || preInfo.topic.confidence < 3;
        
        if (depStudied && preWeak) {
          alerts.push({
            topicId: preInfo.topic.id,
            topicName: preInfo.topic.name,
            dependentId: depInfo.topic.id,
            dependentName: depInfo.topic.name,
            reason: dep.reason,
          });
        }
      }
    });
    
    return alerts;
  }, [getTopicById]);

  const getMistakeReplayQuestions = useCallback((count: number = 3) => {
    const now = new Date();
    return state.mistakes
      .filter(m => m.status === 'pending' && new Date(m.nextReplayDate) <= now)
      .sort((a, b) => new Date(a.nextReplayDate).getTime() - new Date(b.nextReplayDate).getTime())
      .slice(0, count);
  }, [state.mistakes]);

  const getInsightCalibration = useCallback(() => {
    const dismissed = state.insights.filter(i => i.dismissed && i.relatedTopicId);
    let verified = 0;
    dismissed.forEach(insight => {
      const afterTests = state.testAttempts.filter(t => t.date > insight.date);
      if (afterTests.length === 0) return;
      const relatedAnswers = afterTests.flatMap((t) => t.questions.map((q, qi) => ({ q, correct: t.answers[qi] === q.correctAnswer, topicId: q.topicId }))).filter(x => x.topicId === insight.relatedTopicId);
      if (relatedAnswers.length > 0) {
        const acc = relatedAnswers.filter(a => a.correct).length / relatedAnswers.length;
        if (acc >= 0.6) verified++;
      }
    });
    return {
      totalInsights: state.insights.length,
      dismissedInsights: dismissed.length,
      verifiedImprovements: verified,
      calibrationRate: dismissed.length > 0 ? Math.round((verified / dismissed.length) * 100) : 0,
    };
  }, [state.insights, state.testAttempts]);

  const contextValue: StoreContextType = {
    state,
    dispatch,
    getTopicById,
    getSubjectStats,
    getReadinessScore,
    getOverallReadiness,
    getTodayStudyHours,
    getPendingRevisions,
    getOverdueRevisions,
    getTodaysRevisions,
    getWeakTopics,
    getStrongTopics,
    generateDailyPlan,
    generateInsights,
    updateStreaks,
    logStudy,
    completeTopicWithRevisions,
    getExpectedJEEPerformance,
    getStudyTimeEfficiency,
    getWhatToStudyNext,
    getTopicForgettingProbability,
    getBurnoutTelemetry,
    getRankTrajectories,
    getDailyROIEngineTasks,
    getExamSimulationBreakdown,
    getPrerequisiteGaps,
    getMistakeReplayQuestions,
    getInsightCalibration,
    toggleTopicExclusion: useCallback((topicId: string) => dispatch({ type: 'TOGGLE_TOPIC_EXCLUSION', payload: { topicId } }), [dispatch]),
    addResource: useCallback((resource: StudyResource) => dispatch({ type: 'ADD_RESOURCE', payload: resource }), []),
    removeResource: useCallback((id: string) => dispatch({ type: 'REMOVE_RESOURCE', payload: id }), []),
    toggleHiddenSubject: useCallback((subjectId: SubjectId) => dispatch({ type: 'TOGGLE_HIDDEN_SUBJECT', payload: subjectId }), [dispatch]),
    toggleHiddenChapter: useCallback((chapterId: string) => dispatch({ type: 'TOGGLE_HIDDEN_CHAPTER', payload: chapterId }), [dispatch]),
    isItemHidden,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
