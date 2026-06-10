import re

with open('src/app/api/chat/route.ts', 'r') as f:
    content = f.read()

# 1. Hoist keywords and add isGeneralWebSearchQuery
hoist_code = """];

const GREETINGS = ['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening'];
const CAPABILITIES = ['what can you do', 'who are you', 'what are your capabilities', 'what do you do', 'help me', 'how to use', 'features', 'what is this website'];
const JEE_KEYWORDS = [
  'jee', 'neet', 'iit', 'nit', 'syllabus', 'cutoff', 'exam date', 'exam pattern',
  'previous year', 'pyq', 'ncert', 'coaching', 'nta', 'rank predictor', 'percentile',
  'physics', 'chemistry', 'maths', 'mathematics', 'formula', 'theorem', 'derivation',
  'solve', 'calculate', 'derive', 'prove', 'evaluate', 'integrate', 'differentiate',
  'equilibrium', 'reaction', 'organic', 'inorganic', 'electrostatics', 'magnetism',
  'kinematics', 'thermodynamics', 'optics', 'waves', 'modern physics', 'nuclear',
  'newton', 'coulomb', 'gauss', 'faraday', 'ohm', 'kirchhoff', 'bernoulli',
  'coordinate geometry', 'calculus', 'probability', 'matrices', 'vectors', 'trigonometry',
  'sets', 'relations', 'functions', 'inequalities', 'complex numbers', 'binomial',
  'permutations', 'combinations', 'sequences', 'series', 'limits', 'continuity',
  'differentiability', 'integration', 'area', 'differential equations',
  'straight lines', 'circles', 'parabola', 'ellipse', 'hyperbola',
  'mole concept', 'atomic structure', 'periodic table', 'chemical bonding',
  'thermodynamics chemistry', 'chemical kinetics', 'electrochemistry', 'solutions',
  'hydrocarbons', 'organic chemistry', 'goc', 'isomerism', 'p block', 'd block',
  'friction', 'newton laws', 'work energy', 'rotation', 'gravitation', 'shm',
  'tips', 'tricks', 'shortcuts', 'how to solve', 'method', 'strategy',
];
const EXPLICIT_SEARCH = ['search', 'look up', 'find online', 'realtime', 'latest update', 'current news', 'tavily', 'web search', 'research', 'google', 'bing'];

function isGeneralWebSearchQuery(query: string): boolean {
  if (isTextbookQuery(query)) return false;
  const lower = query.toLowerCase();
  
  if (GREETINGS.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + '!'))) return false;
  if (CAPABILITIES.some(c => lower.includes(c) || lower === 'help' || lower === '?')) return false;

  if (EXPLICIT_SEARCH.some(kw => lower.includes(kw))) return true;
  if (/\b20(2[4-9]|[3-9]\d)\b/.test(query)) return true;
  
  const TIME_SENSITIVE = ['latest', 'current', 'recent', 'today', 'this year', 'now', 'breaking', 'news', 'announce', 'released', 'winner', 'won', 'champion', 'finals', 'tournament'];
  if (TIME_SENSITIVE.some(kw => lower.includes(kw))) return true;

  return false;
}
"""

content = content.replace("  'master resource book', 'jee advanced', 'jee main',\n];", "  'master resource book', 'jee advanced', 'jee main',\n" + hoist_code)

# 2. Add webSearchResults block after textbookSearchResults
web_search_block = """          } catch (e) {
            console.warn('Textbook search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [], error: true } });
            sendEvent({ type: 'step_end', step: 'textbook_search', result: { error: true } });
          }
        }

        let webSearchResults: any = null;
        if (!textbookSearchResults && isGeneralWebSearchQuery(latestQuery) && tavilyApiKey) {
          sendEvent({ type: 'step_start', step: 'web_search' });
          sendEvent({ type: 'status', message: 'Searching the web for current information...' });
          sendEvent({ type: 'tool_start', id: 'call_search', name: 'tavily_search' });
          try {
            webSearchResults = await executeTavilySearch(latestQuery, tavilyApiKey);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: webSearchResults });
            sendEvent({ type: 'status', message: 'Synthesizing response and generating answer...' });
            sendEvent({ type: 'step_end', step: 'web_search', result: { completed: true } });
          } catch (e) {
            console.warn('General web search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'call_search', name: 'tavily_search', result: null, error: true });
            sendEvent({ type: 'step_end', step: 'web_search', result: { error: true } });
          }
        }"""

content = content.replace("""          } catch (e) {
            console.warn('Textbook search failed (non-fatal):', e);
            sendEvent({ type: 'tool_end', id: 'textbook_search', name: 'textbook_search', result: { results: [], error: true } });
            sendEvent({ type: 'step_end', step: 'textbook_search', result: { error: true } });
          }
        }""", web_search_block)

# 3. Inject web results into fallback content
fallback_content_replace_1 = """            } else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results\\n\\nI searched the web for "${latestQuery}" and found the following:\\n\\n`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}\\n\\n`;
              contentStr += `**Sources:**\\n`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})\\n`;
              });
              sendEvent({ type: 'text', content: contentStr });
            } else {
              await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
            }"""

content = content.replace("""            } else {
              await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
            }
            controller.close();
            return;
          }""", fallback_content_replace_1 + "\n            controller.close();\n            return;\n          }", 1)

content = content.replace("""            } else {
            await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
          }
          controller.close();
          return;
        }""", fallback_content_replace_1 + "\n            controller.close();\n            return;\n          }", 1)

content = content.replace("""            } else {
              await runSmartFallback(latestQuery, tavilyApiKey || '', sendEvent);
            }
            controller.close();
        }""", fallback_content_replace_1 + "\n            controller.close();\n        }", 1)

# Fix indentation issue for the exact match fallback replacements
# Just use regex to safely replace the specific else { runSmartFallback... } blocks
content = re.sub(
    r"(\} else \{\s+await runSmartFallback\(latestQuery, tavilyApiKey \|\| '', sendEvent\);\s+\}\s+controller\.close\(\);\s+(?:return;)?\s+\})",
    r"""} else if (webSearchResults?.results?.length > 0) {
              let contentStr = `### 🌐 Web Search Results\n\nI searched the web for "${latestQuery}" and found the following:\n\n`;
              if (webSearchResults.answer) contentStr += `${webSearchResults.answer}\n\n`;
              contentStr += `**Sources:**\n`;
              webSearchResults.results.slice(0, 3).forEach((res: any, idx: number) => {
                contentStr += `${idx + 1}. [${res.title}](${res.url})\n`;
              });
              sendEvent({ type: 'text', content: contentStr });
            \1""",
    content
)

# 4. Augment system prompt
augmented_prompt_replace = """augmentedSystemPrompt += `\\n\\n---\\n### Tool Action Markers\\nWhen you intend to update a topic's status, include this exact marker in your response:\\n[MARK:Topic Name:status]\\n- Valid statuses: learning, in progress, completed, revised, mastered, not started\\n- Example: "I'll mark that for you now. [MARK:Linear Inequalities:in progress]"\\n\\nWhen you intend to log study time, include:\\n[LOG:Topic Name:minutes]\\n- Example: "I've logged your study session. [LOG:Kinematics:45]"\\n\\nPlace the marker naturally in your response text. The system will process it automatically.`;

          augmentedSystemPrompt += `\\n\\n### 🔎 Web Search Tooling & Capabilities\\n- You DO NOT have direct access to a web browser or search tool.\\n- For queries requiring real-time information or specific resources, the system attempts to run a search BEFORE calling you.\\n- IF a search was performed, the results will be injected below under "📚 Textbook Search Results" or "🌐 Web Search Results". Treat those injected results as ground truth, cite their sources, and NEVER deny that a search was run.\\n- IF NEITHER heading is present below, NO SEARCH WAS PERFORMED. You MUST NOT pretend to have run a search. If the user asks for real-time info (e.g., current events, "who won", future dates), honestly state that you lack real-time web access and cannot browse the internet, and recommend they use a search engine.`;

          // Inject textbook search results if available
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            const resourcesInfo = resources.map((r: any, i: number) =>
              `${i + 1}. **${r.name}** — ${r.description ? r.description.substring(0, 100) + '...' : ''}\\n   📥 ${r.url}`
            ).join('\\n');
            augmentedSystemPrompt += `\\n\\n---\\n### 📚 Textbook Search Results\\n*The system ran a textbook search for you. Here are the findings — you can reference them confidently:*\\n\\n${resourcesInfo}\\n\\nIf the student asks for the exact text of a specific exercise, point them to the PDF link above rather than inventing questions. The resources have been added to the student's Material Library automatically.`;
          }

          // Inject general web search results if available
          if (webSearchResults?.results?.length > 0) {
            let webInfo = '';
            if (webSearchResults.answer) webInfo += `**Summary:** ${webSearchResults.answer}\\n\\n`;
            webInfo += `**Sources:**\\n` + webSearchResults.results.map((r: any, i: number) => 
              `${i + 1}. [${r.title}](${r.url})\\n${r.content.substring(0, 200)}...`
            ).join('\\n\\n');
            augmentedSystemPrompt += `\\n\\n---\\n### 🌐 Web Search Results\\n*The system ran a web search for you. Here are the findings:*\\n\\n${webInfo}`;
          }"""

old_augmented = """augmentedSystemPrompt += `\\n\\n---\\n### Tool Action Markers\\nWhen you intend to update a topic's status, include this exact marker in your response:\\n[MARK:Topic Name:status]\\n- Valid statuses: learning, in progress, completed, revised, mastered, not started\\n- Example: "I'll mark that for you now. [MARK:Linear Inequalities:in progress]"\\n\\nWhen you intend to log study time, include:\\n[LOG:Topic Name:minutes]\\n- Example: "I've logged your study session. [LOG:Kinematics:45]"\\n\\nPlace the marker naturally in your response text. The system will process it automatically.`;

          // Inject textbook search results if available
          if (textbookSearchResults?.results?.length > 0) {
            const resources = textbookSearchResults.results
              .map((r: any) => buildResourceFromResult(r, latestQuery))
              .filter((r: any): r is any => r !== null);
            const resourcesInfo = resources.map((r: any, i: number) =>
              `${i + 1}. **${r.name}** — ${r.description ? r.description.substring(0, 100) + '...' : ''}\\n   📥 ${r.url}`
            ).join('\\n');
            augmentedSystemPrompt += `\\n\\n---\\n### 📚 Textbook Search Results\\n*The system ran a web/textbook search for you. Here are the findings — you can reference them confidently:*\\n\\n${resourcesInfo}\\n\\nIf the student asks for the exact text of a specific exercise, point them to the PDF link above rather than inventing questions. The resources have been added to the student's Material Library automatically.`;
          }"""

content = content.replace(old_augmented, augmented_prompt_replace)

# 5. Remove local declarations in runSmartFallback
content = re.sub(r"  const GREETINGS = \['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening'\];\n  const CAPABILITIES = \['what can you do', 'who are you', 'what are your capabilities', 'what do you do', 'help me', 'how to use', 'features', 'what is this website'\];\n  \n  const isGreeting = GREETINGS\.some\(g => lowerQuery === g \|\| lowerQuery\.startsWith\(g \+ ' '\) \|\| lowerQuery\.startsWith\(g \+ '!'\)\);\n  const isCapability = CAPABILITIES\.some\(c => lowerQuery\.includes\(c\) \|\| lowerQuery === 'help' \|\| lowerQuery === '\?'\);\n  \n  const JEE_KEYWORDS = \[.*?\];\n  const EXPLICIT_SEARCH = \['search', 'look up', 'find online', 'realtime', 'latest update', 'current news', 'tavily', 'web search'\];\n  \n  const hasJEEContext = JEE_KEYWORDS\.some\(kw => lowerQuery\.includes\(kw\)\);\n  const hasExplicitSearch = EXPLICIT_SEARCH\.some\(kw => lowerQuery\.includes\(kw\)\);\n  \n  const isSearchWorthy = \(hasJEEContext \|\| hasExplicitSearch\) && !isGreeting && !isCapability;", """  const isGreeting = GREETINGS.some(g => lowerQuery === g || lowerQuery.startsWith(g + ' ') || lowerQuery.startsWith(g + '!'));
  const isCapability = CAPABILITIES.some(c => lowerQuery.includes(c) || lowerQuery === 'help' || lowerQuery === '?');
  const hasJEEContext = JEE_KEYWORDS.some(kw => lowerQuery.includes(kw));
  const hasExplicitSearch = EXPLICIT_SEARCH.some(kw => lowerQuery.includes(kw));
  const isSearchWorthy = (hasJEEContext || hasExplicitSearch) && !isGreeting && !isCapability;""", content, flags=re.DOTALL)

with open('src/app/api/chat/route.ts', 'w') as f:
    f.write(content)
