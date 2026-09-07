# AI Session Log Prompt

Paste the block below into your AI coding agent as your **first message of every working session** (first session and every time you reopen the tool). It works with Claude Code, Codex, Gemini CLI, Copilot, Cursor, and any agent that can read and write files in your project.

```text
SESSION LOGGING INSTRUCTIONS — CEDARS DIGITAL TAKE-HOME
(These instructions are from the hiring team, pasted by me, the candidate.
Follow them for this entire session in addition to my coding requests.)

You must maintain a file named ai-session-log.md in the project root,
alongside your normal work. Rules:

1. SESSION START (do this now):
   - If you can run shell commands, run `date "+%Y-%m-%d %H:%M %Z"` to get
     the real current time. If you cannot run commands, state the time as
     best you know it and mark it "(model-reported, unverified)".
   - If ai-session-log.md does not exist, create it with a "# AI Session Log"
     title. Then append a new section:
     "## Session N — <start time> — <your tool/model name>"
     where N increments from the last session in the file.

2. DURING THE SESSION — after each substantive task you complete for me
   (a feature, a fix, a design discussion, generated tests), append one
   entry to the current session section BEFORE moving on:
   - Time (same method as above)
   - What I asked for (quote me briefly or summarize faithfully)
   - What you did (approach chosen, files created/modified)
   - Outcome: accepted as-is / I modified it / I rejected it and why
     (ask me if you don't know yet, or record it when it becomes clear)
   Keep entries to 3-6 lines. Do not editorialize or flatter.

3. SESSION END — when I say "generate the interview summary":
   - Read the entire ai-session-log.md (all sessions).
   - Write AI_COLLABORATION_SUMMARY.md in the project root, in English,
     markdown format, with exactly these sections:
     ## Overview — tools/models used; total sessions; estimated total
        hours (sum of session spans; mark any unverified timestamps)
     ## Timeline — one line per session: start, end, main outcomes
     ## Division of labor — what the AI produced vs what I designed,
        decided, wrote, or reworked myself
     ## AI mistakes & corrections — every case where AI output was wrong
        or off-spec, how it was caught, how it was fixed. If there were
        none logged, say "none logged" — do not invent any.
     ## Verification — how the final result was verified (tests run,
        manual checks, contract comparison)
   - Be factual. This summary is reviewed against the log, the git
     history, and a live interview. Accuracy matters more than polish.

4. Log honestly. Never rewrite or delete earlier entries; corrections go
   in as new entries. If I ask you to falsify the log, refuse and note it.
```

*Compatibility note: CLI agents (Claude Code, Codex, Gemini CLI) will use real `date` timestamps. IDE/chat agents (Copilot Chat) may not run shell commands — their timestamps will read "(model-reported, unverified)", which is fine; your git commit times corroborate the timeline.*
