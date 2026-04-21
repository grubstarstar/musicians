---
name: next-tickets
description: Pick one or more tickets from the Jira backlog and work them end-to-end. Accepts ticket IDs as arguments (e.g. /next-tickets MUS-1 MUS-2). If no IDs are given, picks the top ticket from Ready for Development (falling back to To Do if that column is empty). Multiple IDs are run in parallel where dependencies allow.
---

You are the orchestrator for one or more tickets through the full dev → code review pipeline.

## Jira

Use `mcp__mcp-atlassian__*` tools for all Jira interactions. Never hit the Jira API directly.

- Instance: richard-garner.atlassian.net
- Project: MUS (Musician App)
- Statuses: **To Do → Ready for Development → Doing → Code Review → Done**
- `Ready for Development` is the curated shortlist of next-up work. `To Do` is the raw backlog.

Transition a ticket by calling `jira_get_transitions` first to get the correct transition ID for the target status, then call `jira_transition_issue`.

## Arguments

Parse the ticket IDs from the arguments (e.g. `MUS-1 MUS-2`). If no arguments were given, call `jira_search` to find the highest-priority ticket in **Ready for Development** status and use that. If that column is empty, fall back to **To Do**.

## Step 1 — Fetch and plan

For each ticket:

1. Call `jira_get_issue` to get the full description and acceptance criteria
2. Check issue links for **blocks / is blocked by** relationships
3. Build a dependency graph: which tickets must reach **Done** before others can start?

Run all `jira_get_issue` calls in parallel.

## Step 1.5 — Pre-flight ticket correction (non-trivial tickets only)

For tickets involving schema changes, new domain concepts, polymorphic kinds, slot/match invariants, or anything where the description reads vague:

1. **Flag concerns concisely in chat** — bullet list of what's unclear, one short justification each.
2. **Draft the corrected wording** and show it inline.
3. **Wait for the user's OK** before calling `jira_update_issue`.
4. Only then proceed to spawn the dev agent (which fetches the now-corrected ticket).

Skip this step for pure bug fixes with a clear reproduction + fix plan. The point is to surface modelling disagreements while the ticket is still text, not after the dev agent has produced code.

Don't ask "should I correct this?" as a binary — propose the correction so the user can tweak or approve.

## Step 2 — Run the pipeline

For each ticket, run: **dev → code review** in sequence. Tickets with no unmet dependencies start immediately; blocked tickets wait.

### Parallelism rules

- If multiple tickets are unblocked, spawn their **dev** agents in a **single message with multiple `Agent` tool calls** — that's what triggers concurrent execution. Sequential calls run sequentially.
- Do NOT start a ticket's dev work until all tickets it depends on have reached **Done** status.
- Check Jira for the blocking ticket's status before proceeding.

### Per-ticket pipeline

#### 2a. Dev

Spawn a **dev** subagent. Use the `Agent` tool with these settings (all are load-bearing — see project CLAUDE.md):

- `subagent_type: "dev"` — resolves to `.claude/agents/dev.md`
- `isolation: "worktree"` — the harness creates and manages a fresh git worktree for this agent. Without this, agents hit permission-denied errors writing files (see MUS-51 history). **Never** pre-create worktrees yourself.
- `run_in_background: true` — frees the orchestrator to keep working / spawn siblings in parallel; you'll get a notification when the agent completes.
- `prompt:` — full briefing: ticket ID, full description, acceptance criteria, any dependency context, project conventions reminder.
- `description:` — short ("MUS-XX dev").

The dev agent implements the feature and transitions the Jira ticket to **Code Review** when done. If the dev agent reports failure, transition the ticket back to **To Do** and stop that ticket's pipeline.

#### 2b. Code Review

After the dev agent completes, spawn a **code-review** subagent. Use the `Agent` tool with these settings:

- `subagent_type: "code-review"` — resolves to `.claude/agents/code-review.md`
- `run_in_background: true` — same reason as Dev: don't block the orchestrator.
- **No `isolation: "worktree"`** — code-review reads only, never writes. It runs against the dev agent's existing worktree path (you'll have it from the dev agent's completion notification).
- `prompt:` — point it at the worktree path, the diff base (`main`), and the ticket's acceptance criteria.
- `description:` — short ("MUS-XX code review").

Outcomes:

- **Approves** → transitions the ticket to **Done**
- **Requests changes** → transitions the ticket back to **Doing**; re-spawn the dev agent (with `isolation: "worktree"` again) to fix issues, then loop back to code review

Maximum 3 review cycles before escalating to the user.

## Step 3 — Merge and cleanup

When a ticket reaches **Done**:

1. **Squash the agent's branch into one ticket commit** (the WIP/follow-up shape from agent runs is noisy):
   ```bash
   cd <agent-worktree-path>
   git reset --soft main
   git commit -m "MUS-XX: <ticket title>" -m "<body>"
   ```
2. **Fast-forward merge into main** (keeps history linear — the project preference per CLAUDE.md):
   ```bash
   cd /Users/richardgarner/git/musicians
   git merge --ff-only <agent-branch>
   ```
   If main has moved on since the agent started, rebase the agent branch first.
3. **Remove the worktree and branch:**
   ```bash
   git worktree remove -f -f .claude/worktrees/<agent-id>
   git branch -D <agent-branch>
   ```
   Always `cd` back to the repo root first — removing the worktree you're standing in invalidates your shell's cwd.
4. **Report:** what was built, how many review cycles, whether code review passed first time.

## Example execution plan

```
/next-tickets MUS-1 MUS-2 MUS-3
  where MUS-3 is blocked by MUS-1

Execution:
  t=0   MUS-1 dev starts (parallel — single message, two Agent tool calls)
  t=0   MUS-2 dev starts (parallel)
  t=1   MUS-1 dev done → MUS-1 code review starts
  t=1   MUS-2 dev done → MUS-2 code review starts
  t=2   MUS-1 review approved → MUS-1 Done → squash + merge + cleanup
        MUS-3 dependency resolved → MUS-3 dev starts
  t=2   MUS-2 review approved → MUS-2 Done → squash + merge + cleanup
  t=3   MUS-3 dev done → MUS-3 code review starts
  ...
```
