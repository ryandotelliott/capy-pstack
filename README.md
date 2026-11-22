# capy-pstack

A [Capy](https://capy.ai) port of [pstack](https://github.com/cursor/plugins/tree/main/pstack), Lauren Tan's ([@poteto](https://x.com/poteto)) set of skills for rigorous agent engineering. pstack was designed and written for Cursor. This repository only adapts it to run in Capy, and every skill, playbook, and principle in it is hers.

## Install

1. In Capy, open Settings → MCP & plugins and choose **From GitHub repository**.
2. Paste `https://github.com/ryandotelliott/capy-pstack/tree/main/plugin` and pick **Only me** or **Organization**, and the projects it covers.
3. In a thread, run `$setup-pstack` once to choose models per role. It writes `pstack/pstack-models.md` in your personal Drive.
4. Start rigorous work with `$poteto-mode <task>`. Ask `$poteto-help` when you are unsure which skill fits.

Plugin skills run in threads on cloud machines. A GitHub plugin updates only when you click **Sync** on its plugin page.

## How the port works

Upstream skills keep their Cursor wording. The port does not rewrite them. Instead it follows the approach upstream already uses for Claude Code:

- [`adapter/capy.md`](adapter/capy.md) maps every Cursor tool, subagent field, model slug, path, and Cursor-only feature that pstack uses to its Capy equivalent. For example, `Task` becomes `tools.subagent.create`, `environment: "cloud"` becomes `machine: "fresh"`, `claude-opus-5-5-xhigh-fast` becomes `anthropic/claude-opus-5-5` at `xhigh`, and Bugbot becomes Capy's review findings. It ships as the `pstack-capy` skill.
- [`scripts/generate.mjs`](scripts/generate.mjs) builds `plugin/` from the vendored upstream and the adapter. It adds a line under the title of each SKILL.md that uses a Cursor name, telling the agent to read `pstack-capy` first. It fails when a skill uses a Cursor term the adapter has no row for, so a new upstream term cannot slip through unmapped.
- Capy loads only `skills/` from a plugin and ignores `agents/`. So the generator moves the files skills read at runtime into `skills/pstack-capy/references/`: the README, the guide, and the `poteto-agent` and `comment-sicko` agent definitions, which subagents read as their first step. It rewrites relative links to match. A link to an upstream file the plugin leaves out points at that file on GitHub, pinned to the vendored commit.

## Layout

| Path | What it is |
| --- | --- |
| `upstream/pstack/` | pstack as vendored from cursor/plugins. Never edit it by hand. |
| `upstream/source.json` | The upstream commit that `upstream/pstack/` came from. |
| `adapter/capy.md` | The Cursor-to-Capy mapping. This is the file to edit. |
| `scripts/sync-upstream.sh` | Re-vendors upstream at a ref. |
| `scripts/generate.mjs` | Builds `plugin/`. Run it with `--check` to fail on drift. |
| `plugin/` | The generated Capy plugin. This is the folder Capy installs. |

## Update to a newer pstack

```bash
scripts/sync-upstream.sh main     # or a commit sha
node scripts/generate.mjs         # fails if upstream added a Cursor term with no adapter row
git add -A && git commit -m "chore: sync pstack to <sha>"
```

If the generator reports a missing row, add it to `adapter/capy.md` and run it again. After you push, click **Sync** on the plugin page in Capy. CI runs `node scripts/generate.mjs --check` on every push.

## Known gaps

- `make-bot-ui` drives a Cursor-only routine UI, so most of it is skipped in Capy.
- Most pstack skills set `disable-model-invocation: true`. Capy's docs don't say whether it honors that field, so pstack skills may be suggested without being named.
- `automations/benny`, the overnight Cursor automation, is not ported. Its links point at GitHub.
- Capy's own rules win over pstack's. The main difference is merging: Capy merges only a PR you explicitly asked it to merge in the conversation, or one covered by a standing grant in the repository's `AGENTS.md`.

## License

MIT. pstack is copyright Lauren Tan, and [LICENSE](LICENSE) is its license. The adapter and scripts here are released under the same terms.
