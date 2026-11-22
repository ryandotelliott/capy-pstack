---
name: pstack-capy
description: Capy adapter for the pstack skills. Read it once per thread before you follow any pstack skill, such as poteto-mode, setup-pstack, arena, swarm, or interrogate. It maps their Cursor tool, subagent, model, path, and feature names to Capy.
---

# pstack in Capy

pstack skills use Cursor names. In Capy, read this file once per thread, then map each Cursor name in a skill with the tables below. `<skills>` means the folder that holds this skill's folder, so another pstack skill is at `<skills>/<name>/SKILL.md` and the location in your available skills list names the same file. If a Cursor field has no row, drop it and say so. Never pass a field or value a tool schema rejects.

Capy's platform rules and the repository's `AGENTS.md` win wherever they conflict with a pstack skill. pstack's reply style still applies to what you send. Your reply is the `message_user` text, never plain assistant text.

## Tools

| Cursor | Capy |
| --- | --- |
| `Task` | `tools.subagent.create` with a `start` object, inside `execute`. The brief is the task's `prompt`. Read the `rejected` list after a batch start. A finished subagent wakes you on its own. To collect a panel in one wake, call `wait` with its paths in `subagents` and `return_when: "all"`. Read its result with `tools.subagent.get`, and its diff with `tools.capy.bash` and `machine: { subagent: "<path>" }`. |
| `AskQuestion` | `clarify_questions`. It ends your turn, and the answer arrives as the next message, so ask it last. A worker never asks. |
| Open a todolist, or copy steps into the todolist tool | Capy has no todo tool. Keep the list in `~/.capy/work/pstack/<thread code>/todo.md` and update it at each phase. When the thread records its work on an issue, mirror phase changes there. |
| Run another pstack skill (`/name` or "the **name** skill") | Read `<skills>/<name>/SKILL.md` and follow it. When you tell the user to type it, write `$<name>`. |
| `Grep`, `Glob` | `tools.capy.bash` with `rg`. |

## Subagent fields

| Cursor | Capy |
| --- | --- |
| `subagent_type: generalPurpose` | A plain subagent. Capy has no subagent types, so drop the field. |
| `poteto-agent`, `comment-sicko` | Capy has no named agents and ignores a plugin's `agents/`. Start a plain subagent whose prompt opens with `Read <skills>/pstack-capy/references/agents/<name>.md and act as that agent.`, then the lines the calling skill requires, such as poteto-mode's `worker.md` line and its own absolute path. If a path is missing on the subagent's machine, it finds the same skill by name in its own available skills list. |
| The `model:` line in `poteto-agent`'s file | It holds a Cursor slug. Pass `start.model` on every start, mapped with the Models table, so the slug never reaches the tool. |
| `readonly: true` | `machine: "shared"`. Shared subagents keep their tools, so the brief also says "do not edit files or commit", and you check `git status` afterward. |
| `readonly: false` | `machine: "fresh"` when its writes could collide with yours or another worker's. `machine: "shared"` only for disjoint edits, and only one agent commits on a shared tree at a time. |
| `environment: "cloud"` | `machine: "fresh"`, an isolated cloud machine with a clean checkout. Name the branch or commit the worker starts from. |
| `environment: "local"` | `machine: "shared"`. On a thread that runs on a paired device, `machine: "device"` gives a writer its own worktree there. |
| `cloud_base_branch: <b>` | `repos: [{ repo: "<owner/name>", branch: "<b>" }]` on the task. The branch must be pushed. |
| `run_in_background: true` | Drop it. Subagents always run async and wake you when they finish. |
| `resume` | `message_agent` with `to: "<path>"` and the next instruction. It also resumes a stopped subagent. pstack's rule still holds: prefer a fresh subagent with the original brief and the prior report. |
| `file_attachments` | `files` takes durable file ids shown in this thread. For any other file, list its path in the brief. A fresh machine cannot see your disk, so copy the file there with `tools.transfer.files` first. |
| A shared grounding file or an output path a subagent writes | For shared subagents, use `~/.capy/work/pstack/<run>/`, which every agent on the machine sees. For fresh subagents, read the output from their machine with `tools.capy.read` and `machine: { subagent: "<path>" }`, or copy it with `tools.transfer.files`. |

## Models

The ids you can pass are the ones in `<available_subagent_models>`, each with its reasoning levels. Organization policy can still block one, and the refusal names permitted alternatives.

| Cursor | Capy |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh-fast` | `{ model_id: "anthropic/claude-<family>-<version>", reasoning_mode: "<effort>" }`, so `claude-opus-5-5-xhigh-fast` is `anthropic/claude-opus-5-5` at `xhigh` and `claude-fable-5-2-high` is `anthropic/claude-fable-5-2` at `high`. Drop `-fast`, because Capy's Claude routes have no fast mode. |
| `gemini-<version>-<variant>-<effort>`, such as `gemini-4-neon-xhigh` | `{ model_id: "google/gemini-<version>-<variant>", reasoning_mode: "<effort>" }`. Capy runs Gemini natively, so a Gemini panel seat runs as written. |
| `gpt-*`, `grok-*`, or another vendor's slug | The same family's current id in `<available_subagent_models>`, such as `openai/gpt-6.2-sol` or `xai/grok-4.7`, with the slug's effort as `reasoning_mode`. If the model has no such level, use its highest level at or below it. |
| `auto` or `inherit-parent` | Omit `model`, so the subagent runs on this thread's model. |
| The parent's vendor, for a cross-vendor judge | The vendor of this thread's own model, named in the line that says which model the thread runs on. Fable counts as Claude. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | `pstack/pstack-models.md` in the user's personal Drive, at `~/.capy/drive/user-<name>/pstack/pstack-models.md`. Capy does not load it on its own, so read it before any step that picks a model. If the file or the role's line is missing, use the skill's default slug. |
| A role value `<model_id> <effort>`, such as `anthropic/claude-opus-5-5 high` | `{ model_id: "anthropic/claude-opus-5-5", reasoning_mode: "high" }`. |

## setup-pstack

Follow its steps with these changes:

- Detect. The detected models are the ids in `<available_subagent_models>`, each with the reasoning levels its line lists. Write a real model as `<model_id> <effort>`, such as `anthropic/claude-opus-5-5 xhigh`. The effort is the last token, so the budget step works as written. No Capy value ends in `fast`.
- Defaults. Map each default slug with the rows above: `claude-opus-5-5-xhigh-fast` is `anthropic/claude-opus-5-5 xhigh`, `claude-opus-5-5-high-fast` is `anthropic/claude-opus-5-5 high`, `claude-fable-5-2-high` is `anthropic/claude-fable-5-2 high`, and `gemini-4-neon-xhigh` is `google/gemini-4-neon xhigh`.
- Ask. Ask for the budget and the role choices with `clarify_questions`. It ends the turn, so continue from step 3(b) or step 4 when the answer arrives.
- Write. Write `~/.capy/drive/user-<name>/pstack/pstack-models.md` in the user's own personal Drive folder under `~/.capy/drive/`, with no frontmatter, then the comment lines, the `# defaults: 3` line, the `# budget` line, and one line per role from step 5. Overwrite the whole file. Never put the role lines in a repository or Drive `AGENTS.md`.
- Confirm. The file applies to every later read, in this thread and new ones.

## Paths

| Cursor | Capy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | A repository skill goes in `.agents/skills/<name>/` and is committed. A personal or shared skill goes in a Drive scope's `skills/<name>/` folder under `~/.capy/drive/`, chosen by audience: `user-*` for the user alone, `project-*` for the project, `org-*` for everyone. Write a Drive skill only when the user asks for one. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | The `pstack-capy` entry in your available skills list locates this plugin's skills. There is no version search, so use the copy that list names. |
| `.cursor/rules/*.mdc`, always-applied rules | The repository's `AGENTS.md`, or the root `AGENTS.md` of a Drive scope. Capy never reads `.mdc` files. The model rule is the exception. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | The local copy when the plugin ships it: `README.md`, `guide/`, and `agents/` live in `<skills>/pstack-capy/references/`, and `skills/<name>/` is `<skills>/<name>/`. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | `tools.thread.get` with `thread_id: "this"` and `transcript: {}`, paging with `transcript.before`, or with `materialize: true` to write the transcript to a file you can grep. A subagent's transcript comes from `tools.subagent.get`. "This workspace's transcripts" means this thread, its subagents, and threads you find with `tools.thread.list` and `project: "this"`. Read no other project's threads. |

## Cursor-only features

When a step needs a Cursor feature this table marks as having no Capy equivalent, put one line in your reply, `Skipped in Capy: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, such as a URL or a key, leave a placeholder and name it in the line.

| Cursor | Capy |
| --- | --- |
| A built-in PR tool, or `gh pr create` | `tools.pr.create` with a title and body. Never open a PR with `gh`, or its CI, review, and merge never wake the thread. Edit it with `tools.pr.edit`, comment with `tools.pr.comment`, and read it with `tools.pr.getOverview`, `tools.pr.getChecks`, and `tools.pr.getComments`. For a stack, follow the `gh-stack` skill. This is not a skip, so write no line. |
| Merging, landing a stack, auto-merge | Merge only a PR the user explicitly asked you to merge in this conversation, such as one a "land the stack" instruction names, or under a standing merge grant in the repository's root `AGENTS.md`. Never enable auto-merge. Otherwise report the PR as ready. |
| Bugbot | Bot comments on a PR are ordinary review threads, so read them with `tools.pr.getComments` and resolve them with `tools.pr.updateReviewThread`. Capy's own review posts findings you read with `tools.pr.getFindings` and triage with `tools.pr.updateFindings`. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor's built-in babysit skill, and polling a PR | Follow the **Babysit** playbook. A PR opened with `tools.pr.create` wakes the thread on CI results, reviews, and merge, so end the turn instead of polling, and skip `scripts/watch-pr`. |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes | A recurring routine is `tools.automation.create`, with `enabled: false` unless the user asked for it to go live, verified once with `tools.automation.trigger`. A one-off wake in this run is `wait` with `duration_seconds` or `wake_at`. An inbound webhook is `tools.capy.subscribe`, which mints the URL. Skip a step that needs a routine's Cursor UI, such as a bot UI card. |
| `SendToUser` secret requests | `environment_request_variables` with the variable names. It ends the turn, and you never see the values. |
| Cursor cloud agents | Subagents on `machine: "fresh"`. Their status is `tools.subagent.list` and `tools.subagent.get`. Skip a step that needs the Cursor cloud agent itself, such as its dashboard. |
| Project workers, Cursor Projects | Subagents by default. Start separate threads with `tools.thread.create` only when the user asked for separate threads. The worker's kickoff keeps poteto-mode's `worker.md` line either way. |
| `cursor-team-kit` skills: `/deslop`, `control-ui`, `control-cli` | That plugin is not in Capy. For `/deslop`, review the diff yourself for slop, run the **no-comments** skill, and write the skip line. For `control-ui`, drive the app with `tools.capy.browser` for a web page or `tools.capy.computer` for a desktop app, after reading the `computer-use` skill. For `control-cli`, run the CLI with `tools.capy.bash`. |
