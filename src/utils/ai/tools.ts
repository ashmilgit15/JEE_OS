import { MemoryStore } from './memory';

export const toolSchemas = [

  {
    type: "function",
    function: {
      name: "deep_research",
      description: "Executes a multi-turn deep research loop using the Tavily API. Use this when the user asks a complex question that requires synthesizing multiple sources, exploring nuanced topics, or answering deep conceptual questions where a simple search is not enough.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The core research question or topic to deeply investigate." }
        },
        required: ["query"]
      }
    }
  },


  {
    type: "function",
    function: {
      name: "reset_syllabus",
      description: "Wipes syllabus progress for topics matching the given scope. Sets matched topics back to status='not_started', confidence=0, accuracy=0, and clears revision history. Use this when the user says 'reset everything to 0%', 'mark everything as not started', 'wipe my syllabus progress', 'start from scratch', or scoped variants like 'reset only chemistry', 'reset chapter X', 'reset topic Y'. Destructive action — but executes immediately when the user has given a clear instruction (no confirmation prompt).",
      parameters: {
        type: "object",
        properties: {
          confirmation: { type: "boolean", description: "Optional. Pass true if you want the destructive reset to execute immediately. If the user is ambiguous, you may pass false to surface a confirm dialog instead." },
          scope: { type: "string", enum: ["all", "subject", "chapter", "topic"], description: "What to reset. 'all' = entire syllabus (default), 'subject' = one or more subjects, 'chapter' = one or more chapters, 'topic' = one or more topics." },
          subjects: { type: "array", items: { type: "string" }, description: "When scope='subject', reset only these subjects (e.g. ['physics']). Ignored for other scopes." },
          chapterIds: { type: "array", items: { type: "string" }, description: "When scope='chapter', reset only these chapter IDs (e.g. ['phy-mechanics'])." },
          topicIds: { type: "array", items: { type: "string" }, description: "When scope='topic', reset only these topic IDs." },
          topicNames: { type: "array", items: { type: "string" }, description: "Alternative to topicIds: human-readable topic names like 'Linear Inequalities'. Auto-resolved to topic IDs." },
          chapterNames: { type: "array", items: { type: "string" }, description: "Alternative to chapterIds: human-readable chapter names like 'Mechanics'." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_mock_test",
      description: "Constructs a custom JEE mock test on-the-fly and launches the user directly into the testing arena. CRITICAL: First use deep_research to search the web for the specific NCERT chapter/exercise to find real questions, then generate the test with those questions. Supports topic-level filtering for focused revision.",
      parameters: {
        type: "object",
        properties: {
          subjects: { type: "array", items: { type: "string" }, description: "One or more of 'physics', 'chemistry', 'mathematics'. Pass multiple for a cross-subject test. If omitted, all subjects are included." },
          difficulty: { type: "string", enum: ["easy", "medium", "jee_main", "jee_advanced"], description: "Question difficulty band." },
          questionCount: { type: "number", description: "Number of questions (e.g. 5, 10, 25, 75)." },
          testType: { type: "string", enum: ["topic", "chapter", "mixed", "daily", "mock_main", "mock_advanced"], description: "Test archetype. Defaults to 'mixed' unless subjects filter shrinks to a single subject or topics filter is used (then 'topic')." },
          topicNames: { type: "array", items: { type: "string" }, description: "Optional: filter to questions from these specific topics (e.g. ['Linear Inequalities', 'Quadratic Equations']). Auto-resolved to topic IDs." },
          chapterNames: { type: "array", items: { type: "string" }, description: "Optional: filter to questions from these specific chapters (e.g. ['Algebra', 'Mechanics'])." },
          durationMinutes: { type: "number", description: "Optional: target test duration in minutes (displayed as suggested time, not enforced)." },
          aiAdaptive: { type: "boolean", description: "Inject pending mistake-replay questions and weight weak topics. Default false." },
          title: { type: "string", description: "Optional custom title for the test attempt (e.g. 'Linear Inequalities Sprint')." },
          questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correctAnswer: { type: "number" }, explanation: { type: "string" } } }, description: "OPTIONAL but PREFERRED: Pre-generated questions to inject directly into the test. When the user asks for a specific topic (like 'linear inequalities exercise 6.1'), FIRST search the web for real NCERT questions, then generate them here. Each question MUST have: question (string), options (array of 4 strings), correctAnswer (0-3 index), explanation (string)." }
        },
        required: ["difficulty", "questionCount"]
      }
    }
  },

  {
    type: "function",
    function: {
      name: "generate_flashcards",
      description: "Generates multiple spaced-repetition flashcards for a specific subject or topic and adds them to the user's deck. Automatically navigates to the flashcards page.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", enum: ["physics", "chemistry", "mathematics"], description: "The subject the flashcards belong to." },
          chapterName: { type: "string", description: "Optional: Chapter name." },
          topicName: { type: "string", description: "Optional: Specific topic name." },
          flashcards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                front: { type: "string", description: "Question or term for the front of the card." },
                back: { type: "string", description: "Answer or LaTeX formula for the back of the card." },
                tags: { type: "array", items: { type: "string" }, description: "Tags for categorization." },
                isLatex: { type: "boolean", description: "Set to true if the back contains LaTeX math." }
              },
              required: ["front", "back"]
            }
          }
        },
        required: ["subject", "flashcards"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_topic_status",
      description: "Updates the syllabus tracker status for a specific topic. Optionally sets confidence (1-5), accuracy (0-100), and an inline note. By default, completing/revising/mastering a topic also schedules spaced-repetition revisions on Day 1/7/30.",
      parameters: {
        type: "object",
        properties: {
          topicName: { type: "string", description: "The official name of the topic" },
          status: { type: "string", enum: ["learning", "completed", "revised", "mastered", "not_started"] },
          confidence: { type: "number", description: "Optional: 1-5 confidence rating. Defaults to 4 on completed/revised/mastered, 0 on not_started." },
          accuracy: { type: "number", description: "Optional: 0-100 percent accuracy. Defaults to 80 on completed/revised/mastered, 0 on not_started." },
          note: { type: "string", description: "Optional: a short note attached to the topic (e.g. 'need to redo problems 5-10')." },
          scheduleRevisions: { type: "boolean", description: "If true (default) and status is completed/revised/mastered, auto-schedule Day 1/7/30 revisions. Set false to update status without scheduling." }
        },
        required: ["topicName", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_update_topics",
      description: "Updates the status of MULTIPLE topics at once. Useful for bulk operations like 'mark all of chapter Mechanics as completed', 'set all calculus topics to learning', 'reset all weak topics'. Supports filtering by subject, chapter, or topic name list.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["learning", "completed", "revised", "mastered", "not_started"] },
          subject: { type: "string", enum: ["physics", "chemistry", "mathematics"], description: "Optional: limit to one subject." },
          chapterId: { type: "string", description: "Optional: limit to one chapter ID." },
          chapterName: { type: "string", description: "Optional: limit to one chapter by name (e.g. 'Mechanics')." },
          topicNames: { type: "array", items: { type: "string" }, description: "Optional: explicit list of topic names to update." },
          confidence: { type: "number", description: "Optional: 1-5 confidence rating applied to all." },
          accuracy: { type: "number", description: "Optional: 0-100 accuracy applied to all." },
          onlyWeak: { type: "boolean", description: "If true, only update topics currently below 60% accuracy or below 3 confidence." },
          onlyUnstarted: { type: "boolean", description: "If true, only update topics currently in 'not_started' status." }
        },
        required: ["status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_study",
      description: "Logs a study session for a topic. Supports quality score, session type, sleep/distraction context, and an inline note. Updating a not_started topic to a 'study' session auto-promotes it to 'learning'.",
      parameters: {
        type: "object",
        properties: {
          topicName: { type: "string", description: "The topic you studied" },
          durationMinutes: { type: "number", description: "Duration in minutes (e.g. 30, 60, 90)" },
          type: { type: "string", enum: ["study", "revision", "practice", "test", "school"], description: "Session type. Defaults to 'study'." },
          qualityScore: { type: "number", description: "Optional: 0-100 self-rated quality. Auto-estimated from sleep/distractions if omitted." },
          sleepHours: { type: "number", description: "Optional: hours of sleep the night before. Defaults to 7." },
          distractions: { type: "number", description: "Optional: 0-5 distraction count. Defaults to 0." },
          note: { type: "string", description: "Optional: a short note about the session." }
        },
        required: ["topicName", "durationMinutes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigates the user's screen to a specific path, optionally with query parameters and a sidebar tab.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The path to navigate to, e.g., /syllabus, /tests, /log, /revisions, /mocks" },
          params: { type: "object", description: "Optional: query parameters to attach (e.g. {subject: 'physics', filter: 'weak'}).", additionalProperties: { type: "string" } },
          tab: { type: "string", description: "Optional: a specific tab on the destination page, if applicable." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_plan_task",
      description: "Adds a study task to the planner. Defaults to today's date, but can target a specific date.",
      parameters: {
        type: "object",
        properties: {
          time: { type: "string", description: "Time in HH:MM 24h format, e.g. '16:30'" },
          title: { type: "string", description: "Short task title shown in the planner card" },
          description: { type: "string", description: "Longer description / what to do" },
          type: { type: "string", enum: ["study", "revision", "practice", "test", "break"], description: "Task category. Defaults to 'study'." },
          duration: { type: "number", description: "Planned duration in minutes. Defaults to 60." },
          subject: { type: "string", enum: ["physics", "chemistry", "mathematics"], description: "Optional: subject the task is about." },
          topicId: { type: "string", description: "Optional: linked topic ID for analytics." },
          date: { type: "string", description: "Optional: target date in YYYY-MM-DD. Defaults to today." }
        },
        required: ["time", "title", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_revision",
      description: "Forces a topic into the spaced-repetition queue. Default interval is Day 1 (tomorrow); pass 'daysAhead' to push the first revision further out.",
      parameters: {
        type: "object",
        properties: {
          topicName: { type: "string" },
          daysAhead: { type: "number", description: "Days until the first revision is due. Defaults to 1." }
        },
        required: ["topicName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Updates one or more fields of the user's learning profile. Accepts any subset of the profile fields; pass as key/value pairs.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Display name" },
          class: { type: "string", description: "Class/grade, e.g. '11', '12', 'dropper'" },
          targetYear: { type: "number", description: "Target JEE year, e.g. 2027" },
          coaching: { type: "string", description: "Coaching institute" },
          school: { type: "string", description: "School name" },
          studyHoursPerDay: { type: "number", description: "Daily study target in hours" },
          preferredStudyTime: { type: "string", description: "morning | afternoon | evening | night" },
          studyStyle: { type: "string", description: "visual | auditory | reading | kinesthetic" },
          weakTopics: { type: "array", items: { type: "string" }, description: "Replace weak topics list" },
          strongTopics: { type: "array", items: { type: "string" }, description: "Replace strong topics list" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_insight",
      description: "Adds an insight card to the coach dashboard. Use for noteworthy observations the user should see, like 'you've been neglecting electrostatics for 12 days' or 'great job, you hit a 7-day streak'.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["revision_reminder", "weakness_alert", "accuracy_drop", "priority_suggestion", "achievement", "study_pattern", "forgetting_alert"], description: "Insight category." },
          message: { type: "string", description: "1-2 sentence user-facing message." },
          priority: { type: "string", enum: ["high", "medium", "low"], description: "Optional: defaults to 'medium'." },
          relatedTopicId: { type: "string", description: "Optional: link to a specific topic for the insight." },
          relatedSubject: { type: "string", enum: ["physics", "chemistry", "mathematics"], description: "Optional: link to a subject." }
        },
        required: ["type", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_weekly_goals",
      description: "Updates the user's weekly goals (study hours, topics to complete, tests to take, revisions to complete). Pass only the fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          studyHours: { type: "number", description: "Weekly study hours target" },
          topicsToComplete: { type: "number", description: "Number of topics to mark completed this week" },
          testsToTake: { type: "number", description: "Number of tests/mocks to take this week" },
          revisionsToComplete: { type: "number", description: "Number of revisions to clear this week" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_resource",
      description: "Adds a study resource (PDF link, notes, formula sheet) to the Material Library. Use when the user shares a useful link or asks you to save a resource.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Display name for the resource" },
          url: { type: "string", description: "URL to the resource" },
          type: { type: "string", enum: ["pdf", "notes", "formula_sheet", "dpp", "reference"], description: "Resource type. Defaults to 'reference'." },
          subject: { type: "string", enum: ["physics", "chemistry", "mathematics", "general"], description: "Subject. Defaults to 'general'." },
          description: { type: "string", description: "Optional short description." }
        },
        required: ["name", "url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_resource",
      description: "Removes a resource from the Material Library by its name (fuzzy matched).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Resource name to remove (fuzzy matched)" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_topic_confidence",
      description: "Shortcut for updating only the confidence and accuracy of a topic, without changing its status. Useful for self-rating after a quick practice round.",
      parameters: {
        type: "object",
        properties: {
          topicName: { type: "string" },
          confidence: { type: "number", description: "1-5 confidence rating" },
          accuracy: { type: "number", description: "0-100 accuracy" }
        },
        required: ["topicName", "confidence", "accuracy"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remember",
      description: "Saves a permanent observation about the user to shared memory. Use for things the AI should remember across conversations (preferences, study habits, goals, recurring struggles).",
      parameters: {
        type: "object",
        properties: {
          observation: { type: "string", description: "A specific, durable fact about the user or their study habits" },
          tags: { type: "array", items: { type: "string" }, description: "Optional categorization tags, e.g. ['preference', 'goal', 'weakness']" }
        },
        required: ["observation"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_mistake",
      description: "Logs a question/concept mistake that the user got wrong during a tutorial or practice session. This logs it into the student's mistakes log so they can replay and practice it later in their Revision Engine.",
      parameters: {
        type: "object",
        properties: {
          topicName: { type: "string", description: "The topic name, e.g. 'Friction'." },
          questionText: { type: "string", description: "The question statement or concept explanation that the user failed to answer." },
          options: { type: "array", items: { type: "string" }, description: "Optional: the 4 MCQ options if applicable." },
          correctAnswer: { type: "number", description: "Optional: 0-3 index of the correct option." },
          userAnswer: { type: "number", description: "Optional: 0-3 index of the incorrect option the user picked." },
          explanation: { type: "string", description: "The explanation of the correct solution." }
        },
        required: ["topicName", "questionText", "explanation"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "resolve_mistake",
      description: "Marks a logged mistake as resolved/fixed once the student demonstrates they understand it.",
      parameters: {
        type: "object",
        properties: {
          mistakeId: { type: "string", description: "The unique ID of the mistake to resolve." }
        },
        required: ["mistakeId"]
      }
    }
  },
  ];
export async function executeServerTool(name: string, args: any, memory: MemoryStore) {
  if (name === 'remember') {
    const tags = Array.isArray(args.tags) ? args.tags : [];
    await memory.add(args.observation, 'observation', 'system', tags);
    return { success: true, message: "Observation saved to memory." };
  }
  return { success: false, message: "Server tool not recognized." };
}
