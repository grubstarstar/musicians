---
name: next-tickets
description: Pick one or more tickets from the Jira backlog and work them end-to-end. Accepts ticket IDs as arguments (e.g. /next-tickets MUS-1 MUS-2). If no IDs are given, picks the top ticket from Ready for Development (falling back to To Do if that column is empty). Multiple IDs are run in parallel where dependencies allow.
---

You are the orchestrator for one or more tickets through the full dev → qa-automate → qa-test → code review → QA pipeline.

## Jira

Use `mcp__mcp-atlassian__*` tools for all Jira interactions. Never hit the Jira API directly.

- Instance: richard-garner.atlassian.net
- Project: MUS (Musician App)
- Statuses: **To Do → Ready for Development → Doing → Code Review → QA → Done**
- `Ready for Development` is the curated shortlist of next-up work. `To Do` is the raw backlog.

Transition a ticket by calling `jira_get_transitions` first to get the correct transition ID for the target status, then call `jira_transition_issue`. Common transition IDs on MUS: `21` In Progress, `2` Review (Code Review), `4` QA, `31` Done, `11` To Do.

## Arguments

Parse the ticket IDs from the arguments (e.g. `MUS-1 MUS-2`). If no arguments were given, call `jira_search` to find the highest-priority ticket in **Ready for Development** status and use that. If that column is empty, fall back to **To Do**.

## Step 1 — Fetch and plan

For each ticket:

1. Call `jira_get_issue` to get the full description, acceptance criteria, and **labels** (the `no-e2e` label gates the qa-automate and QA steps below)
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

For each ticket, run: **dev → qa-automate → combine → qa-test → code review → QA → merge** in sequence. Tickets with no unmet dependencies start immediately; blocked tickets wait.

### Parallelism rules

- If multiple tickets are unblocked, spawn their **dev** agents in a **single message with multiple `Agent` tool calls** — that's what triggers concurrent execution. Sequential calls run sequentially.
- Do NOT start a ticket's dev work until all tickets it depends on have reached **Done** status.
- Check Jira for the blocking ticket's status before proceeding.
- **qa-test runs are serial across tickets** — the `MaestroTest` simulator is a shared resource. Do not spawn two qa-test agents concurrently. If two tickets both reach the qa-test step at once, run them back-to-back.

### Per-ticket pipeline

#### 2a. Dev

Spawn a **dev** subagent. Use the `Agent` tool with these settings (all are load-bearing — see project CLAUDE.md):

- `subagent_type: "dev"` — resolves to `.claude/agents/dev.md`
- `isolation: "worktree"` — the harness creates and manages a fresh git worktree for this agent. Without this, agents hit permission-denied errors writing files (see MUS-51 history). **Never** pre-create worktrees yourself.
- `run_in_background: true` — frees the orchestrator to keep working / spawn siblings in parallel; you'll get a notification when the agent completes.
- `prompt:` — full briefing: ticket ID, full description, acceptance criteria, any dependency context, project conventions reminder.
- `description:` — short ("MUS-XX dev").

The dev agent implements the feature and transitions the Jira ticket to **Code Review** when done. Dev's completion comment on the Jira ticket must include a `## HANDOFF` block (`new_testids`, `modified_screens`, `notes_for_e2e`) — the qa-automate step below reads this from Jira.

If the dev agent reports failure, transition the ticket back to **To Do** and stop that ticket's pipeline.

#### 2b. QA Automate (skipped if `no-e2e`)

**Skip this sub-step entirely if the ticket has the `no-e2e` label.** In that case the feature branch contains only dev's commits and you move straight to the combine step.

Otherwise, spawn a **qa-automate** subagent. Use the `Agent` tool with these settings:

- `subagent_type: "qa-automate"` — resolves to `.claude/agents/qa-automate.md`
- `isolation: "worktree"` — qa-automate writes its flow file on its own agent branch from `main`.
- `run_in_background: true` — same reason as Dev.
- `prompt:` — ticket ID only. The agent fetches the Jira description + AC + dev's `## HANDOFF` block itself via `mcp__mcp-atlassian__jira_get_issue`. **Do NOT** pass it dev's diff, dev's worktree path, or any source files dev modified — qa-automate is deliberately blind to dev's implementation (see the "blind to dev's diff" rule in `.claude/agents/qa-automate.md`). Tests written against the spec stay honest; tests written against the code just bless whatever dev produced.
- `description:` — short ("MUS-XX qa-automate").

qa-automate produces one commit on its own agent branch that adds or extends exactly one flow file under `maestro/flows/<journey>/`. It does **not** transition Jira — the orchestrator handles that after combining.

#### 2c. Combine onto feature branch

Both agents have now produced their own branches (dev's branch, and — if the ticket isn't `no-e2e` — qa-automate's branch). Combine them onto a single per-ticket feature branch:

**Critical:** run these commands from the repo root (`/Users/richardgarner/git/musicians`). Never from inside a worktree.

```bash
cd /Users/richardgarner/git/musicians
git checkout main
# Branch name: feature/MUS-NN-short-description (uppercase ticket ID,
# kebab-case slug from the ticket summary — e.g. feature/MUS-72-headless-e2e).
git checkout -b feature/MUS-NN-short-description
git merge --no-ff <dev-branch>
git merge --no-ff <qa-automate-branch>   # skip this line if no-e2e
```

The `--no-ff` keeps each agent's commits grouped under a merge commit, so the feature-branch history shows "dev landed" and "qa-automate landed" as distinct points.

**If a merge conflict appears** (rare — only when dev and qa-automate touch the same file), **stop and surface to the user**. Report the conflicting file(s) and the conflict markers inline. Do not attempt to auto-resolve. The user will either resolve by hand or re-spawn one of the agents with tighter scoping.

#### 2d. qa-test (skipped if `no-e2e`)

**Skip this sub-step entirely if the ticket has the `no-e2e` label.** There are no flows to run; move straight to code-review.

Otherwise, spawn a **qa-test** subagent. Use the `Agent` tool with these settings:

- `subagent_type: "qa-test"` — resolves to `.claude/agents/qa-test.md`
- `isolation: "worktree"` — the harness creates the worktree on the feature branch so qa-test runs the combined dev + qa-automate code.
- `run_in_background: true` — frees the orchestrator; you'll get a notification when it completes.
- `prompt:` — ticket ID only. The agent fetches the Jira description and the journey path itself. Also mention the feature branch name so the agent is oriented (e.g. "feature/MUS-NN-short-description is the combined branch").
- `description:` — short ("MUS-XX qa-test").

qa-test posts a structured result to Jira and returns one of four outcomes in its final message:

- **pass** → continue to step 2e (code-review). Ticket stays in Code Review status.
- **fail (flow bug)** → qa-test has already transitioned the ticket back to **Doing** and posted a failure comment. Re-spawn `qa-automate` on its original branch; after it commits a fix, re-run combine + qa-test. Do NOT run code-review yet.
- **fail (app bug)** → qa-test has already transitioned to **Doing**. Re-spawn `dev` on its original branch; after its fix, re-combine + re-run qa-test. Do NOT run code-review yet.
- **fail (prereq)** or **skipped (prereq)** → qa-test could not run. Surface the named prereq to the user (missing cached app, maestro not installed, etc.) and halt the ticket until the user clears it. No Jira transition.

Maximum 3 qa-test cycles before escalating to the user.

#### 2e. Code Review (against the feature branch)

Spawn a **code-review** subagent. Use the `Agent` tool with these settings:

- `subagent_type: "code-review"` — resolves to `.claude/agents/code-review.md`
- `run_in_background: true` — same reason as Dev: don't block the orchestrator.
- **No `isolation: "worktree"`** — code-review reads only, never writes.
- `prompt:` — point it at the **feature branch** (`feature/MUS-NN-short-description`) at the repo root, with diff base `main`. The review sees dev + qa-automate as one unified diff.
- `description:` — short ("MUS-XX code review").

Outcomes:

- **Approves** → transition the ticket to **QA** (transition id `4`). Continue to step 2f.
- **Requests changes** → transition the ticket back to **Doing** (transition id `21`); re-spawn dev (and/or qa-automate if flow issues were raised) on their original branches to address the feedback, then re-run combine + qa-test + code review. Keep the feature branch — delete it and recreate if dev's branch was reset, otherwise fast-forward the additional fix commits onto it.

Maximum 3 review cycles before escalating to the user.

#### 2f. QA gate

The ticket is now in **QA** status on the feature branch. Because qa-test already ran the Maestro flows in step 2d (or was skipped for `no-e2e`), the QA column is now an automated pass-through: transition straight to **Done** (transition id `31`) and proceed to Step 3 (merge). No manual `pnpm e2e:run` required.

## Step 3 — Merge and cleanup

When the ticket reaches **Done**:

**Critical:** every git command in this section MUST run from the repo root (`/Users/richardgarner/git/musicians`). The harness's previous cwd may still point inside an agent's worktree directory; running `git merge --ff-only <branch>` from inside that worktree merges the branch into itself (no-op on main) and silently leaves main behind. Always start with `cd /Users/richardgarner/git/musicians` — single command, no chaining — before the steps below.

1. **Fast-forward merge the feature branch into main** (keeps history linear):
   ```bash
   cd /Users/richardgarner/git/musicians
   git checkout main
   git merge --ff-only feature/MUS-NN-short-description
   ```
   Verify with `git log --oneline -5` — the top commits should be the feature-branch merges (dev's merge commit, and qa-automate's if present). If it says "Already up to date" but the feature branch isn't on main, you ran the merge from the wrong cwd; redo from the repo root.

   If main has moved on since the feature branch was created, rebase the feature branch first:
   ```bash
   cd /Users/richardgarner/git/musicians
   git checkout feature/MUS-NN-short-description
   git rebase main
   git checkout main
   git merge --ff-only feature/MUS-NN-short-description
   ```

2. **Remove the feature branch, both agent branches, and both worktrees** (also from the repo root):
   ```bash
   cd /Users/richardgarner/git/musicians
   git branch -d feature/MUS-NN-short-description
   git worktree remove -f -f .claude/worktrees/<dev-agent-id>
   git branch -D <dev-agent-branch>
   git worktree remove -f -f .claude/worktrees/<qa-automate-agent-id>   # skip if no-e2e
   git branch -D <qa-automate-agent-branch>                              # skip if no-e2e
   ```
   Standing inside a worktree you're removing leaves the shell with an invalid cwd — subsequent commands fail with "Unable to read current working directory".

3. **Report:** what was built, how many review cycles, how many qa-test cycles, whether code review passed first time, whether qa-test passed first time (or was skipped via `no-e2e`).

## Example execution plan

```
/next-tickets MUS-1 MUS-2 MUS-3
  where MUS-3 is blocked by MUS-1
  MUS-2 has the no-e2e label; MUS-1 and MUS-3 do not

Execution:
  t=0   MUS-1 dev starts (parallel — single message, two Agent tool calls)
  t=0   MUS-2 dev starts (parallel)
  t=1   MUS-1 dev done → MUS-1 qa-automate starts
  t=1   MUS-2 dev done → (no-e2e, skip qa-automate + qa-test) → combine → code review
  t=2   MUS-1 qa-automate done → combine (feature/MUS-1-short-description) → qa-test
  t=2   MUS-2 review approved → QA (auto) → Done → ff-merge + cleanup
  t=3   MUS-1 qa-test PASS → code review approved → QA (auto) → Done → ff-merge + cleanup
        MUS-3 dependency resolved → MUS-3 dev starts
  ...
```
