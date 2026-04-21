---
name: write-jira-story
description: File a new Jira story (or Bug, or Epic) in the MUS project using the project's structured ticket template. Invoke when the user asks to write, create, or file a Jira ticket, story, bug, or task. Captures Summary, Acceptance criteria, E2E coverage, Out of scope, and Labels in a stable shape so downstream agents (dev, qa-automate, code-review) can consume the ticket without guessing.
---

You are filing a Jira ticket in the **MUS** project on `richard-garner.atlassian.net`. Your job is to gather the information needed to fill the project's structured ticket template, validate it, and create the issue via the MCP Atlassian tools.

Never hit the Jira API directly. Use `mcp__mcp-atlassian__*` tools.

## What the user gives you

The user will either:

1. Hand you a rough description of the work in chat ("file a ticket to add X"), or
2. Pass arguments to `/write-jira-story` describing the work.

Either way, treat their input as raw material. You are responsible for shaping it into the template below.

## The required template

Every ticket you file MUST have these five sections, in this order, in the `description` field as Markdown:

Shape:

```
## Summary
<one-paragraph problem statement — why this work matters>

## Acceptance criteria
- [ ] <user-observable behaviour 1>
- [ ] <user-observable behaviour 2>

## E2E coverage
journey: <existing journey name | new: <journey-name> | none>
flow file: <NN-name.yaml | extend NN-existing.yaml | n/a>
key user actions: <bullet list of what the test should drive>

## Out of scope
<explicit non-goals — followups go in separate tickets>

## Labels
- one of: mobile / backend / web / infra
- optionally: no-e2e (if E2E coverage is "none")
- optionally: risky / cross-cutting (signals that smoke-test should run later)
```

The `## Labels` section in the description is human-readable documentation of what labels you set. The actual Jira labels are passed via `additional_fields` when creating the issue (see "Filing the issue" below).

## Step 1 — Decide the issue type

Pick before asking the user any questions, then confirm if ambiguous.

- **Task** — default for normal feature work, refactors, tooling, infra changes.
- **Bug** — only if the user signals a defect: words like "broken", "doesn't work", "regression", "fix the X bug".
- **Epic** — only if the user explicitly says "epic" or asks for a parent ticket grouping multiple stories.

If you are unsure, ask once: "Task, Bug, or Epic?"

## Step 2 — Gather missing information

Compare what the user gave you to what the template needs. For each missing piece, ask a short, targeted question. Do not ask one mega-question — ask in small batches so the user can answer naturally.

Questions you should be ready to ask:

- **Summary** — "In one paragraph, why does this work matter? What's the user-facing or developer-facing problem?"
- **Acceptance criteria** — "What user-observable behaviours must be true when this is done? List them as bullet points." Push back on vague items. "Implement X" is not an AC; "User can tap Y and see Z" is.
- **E2E coverage** — three sub-questions:
  - "Which journey does this fit under? Existing journey name, a new one, or no E2E needed?" The current journeys live under `maestro/flows/**` (today: `request-to-join`).
  - "Flow file: existing `NN-name.yaml` to extend, a new `NN-name.yaml`, or `n/a`?"
  - "What key user actions should the test drive?"
- **Out of scope** — "Anything that someone might assume is included but shouldn't be? Followups go in separate tickets."
- **Labels** — "Which area: mobile, backend, web, or infra?" Plus prompt for `risky` / `cross-cutting` if the change touches shared code, schema, or auth.

Skip questions whose answers are obvious from the user's brief. Do not interrogate.

## Step 3 — Validate before filing

Before calling `jira_create_issue`, confirm all of the following. If any fail, fix them (ask the user) and re-validate. Do not file an invalid ticket.

- Summary section is present and is a paragraph (not just a one-liner heading).
- Acceptance criteria section has at least one `- [ ]` checklist item.
- E2E coverage section has all three lines: `journey:`, `flow file:`, `key user actions:`.
- Out of scope section is present (may legitimately say "none" if there are no non-goals worth calling out, but the section header must exist).
- Labels section is present and at least one area label (`mobile` / `backend` / `web` / `infra`) is chosen.

### The no-e2e label rule (enforce strictly)

- If `E2E coverage` `journey:` is `none`, the `no-e2e` label MUST be in the labels list.
- If `E2E coverage` `journey:` is anything else (an existing or new journey name), the `no-e2e` label MUST NOT be in the labels list.

If the rule is violated, fix the labels yourself before filing — do not ask the user. This is a deterministic mapping.

## Step 4 — Filing the issue

Call `mcp__mcp-atlassian__jira_create_issue` with:

- `project_key`: `MUS`
- `summary`: a short title (under ~70 chars). Not the same as the `## Summary` body — the title goes in the issue's name field.
- `issue_type`: `Task`, `Bug`, or `Epic` (from Step 1).
- `description`: the full filled-in template as Markdown (the five sections above).
- `additional_fields`: a JSON object containing `labels`, e.g. `{"labels": ["mobile", "no-e2e"]}`.

New tickets land in **To Do** by default — do not transition them. The user promotes to `Ready for Development` manually when curated.

After the issue is created, report back to the user with the issue key and URL so they can review.

## Filing notes — Jira ADF rendering gotchas

The MCP `jira_create_issue` tool converts your Markdown to **Jira Wiki markup** and then to ADF. Anything that looks like a Wiki inline-format token gets eaten. Follow these rules when writing the `description`:

**Never put fenced code blocks inside list items.** The converter strips formatting and underscores get interpreted as italics. If you need to show a structured example or a code snippet, hoist it to the top level with a "Shape:" or "Rules:" lead-in like this very SKILL.md does.

**Wrap inline identifiers in single backticks**, especially anything containing underscores (`customfield_10010`, `auth_token`, `key_user_actions`). Without backticks, the underscores become italic markers and the identifier renders as `keyuseractions` with stray italic runs.

**Never use bare Jira Wiki inline-format characters as prose connectors.** In Jira Wiki, `+x+`, `-x-`, `^x^`, `~x~`, `*x*`, `_x_` mean underline / strikethrough / superscript / subscript / bold / italic. When the converter sees `foo + bar` or `useQuery + isLoading` in free text, it can pair the `+` signs and silently delete them, leaving `foo  bar`. Same goes for `-`, `^`, `~` when they appear between tokens.

Rewrite rules — apply to prose **outside** backticks:

- Replace ` + ` with ` and ` (or ` plus `, ` with `, ` alongside `) — never a bare `+`.
- Replace ` & ` with ` and `.
- Replace bare `~` used to mean "approximately" with the word `approximately` or `~`-inside-backticks.
- Hyphenated phrases are fine (`user-observable`, `zero-groups`) — the danger is only `-word-` with whitespace either side.
- If you genuinely need the literal character to appear, wrap the whole phrase in backticks: `` `a + b` `` renders as a monospace `a + b` and is safe.

**Avoid single-asterisk emphasis** (`*like this*`). Use `**bold**` sparingly when you need emphasis. Plain text is safest.

**Avoid backslash escapes** in the description body — they leak through the converter as literal backslashes.

**Prefer ASCII punctuation where possible.** Em-dashes (`—`) and en-dashes (`–`) pass through cleanly, but curly quotes (`"` `"` `'` `'`) and other fancy glyphs sometimes don't — stick to straight quotes in the description body.

These rules apply to the `description` you pass to `jira_create_issue`. They do not apply to chat with the user.

### Pre-flight scan (enforce strictly)

Before calling `jira_create_issue`, scan the `description` text you are about to send and reject it if any of these patterns appear **outside backtick-wrapped spans**:

- ` + ` (space-plus-space) between words
- ` & ` (space-ampersand-space) between words
- ` - ` in a context that looks like `word - word` inline inside a sentence (bullet-list dashes at line starts are fine)
- A bare `~` used as "approximately"

If you find a hit, rewrite it per the rules above, then re-scan. Do not file until the scan is clean. If unsure whether something is risky, wrap it in backticks — backticks are always safe.

## Step 5 — Confirm and hand off

Reply to the user with:

- The Jira issue key (e.g. `MUS-99`).
- A one-line recap of the title.
- A note on which labels were applied (especially if `no-e2e` was auto-added or auto-removed by the rule above).
- The browse URL: `https://richard-garner.atlassian.net/browse/<KEY>`.

If anything went wrong (validation failure the user couldn't resolve, MCP error, etc.), report the blocker and do not retry silently.

## Out of scope for this skill

- Inferring the journey or flow file from a feature description. Always ask.
- Setting sprint, priority, fix versions, assignee, or epic links. The user/PM handles these in Jira.
- Backfilling old tickets to this template.
- Promoting the ticket past **To Do** — the human curates the `Ready for Development` shortlist.
