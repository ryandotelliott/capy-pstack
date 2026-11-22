#!/usr/bin/env node

// Builds plugin/, the Capy plugin, from upstream/pstack and adapter/capy.md.
// Run with --check to fail when plugin/ is out of date instead of writing it.

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PSTACK = join(ROOT, "upstream", "pstack");
const SKILLS = join(PSTACK, "skills");
const OUT = join(ROOT, "plugin");
const ADAPTER = join(ROOT, "adapter", "capy.md");
const SOURCE = JSON.parse(readFileSync(join(ROOT, "upstream", "source.json"), "utf8"));
const UPSTREAM_URL = SOURCE.repository + "/blob/" + SOURCE.commit + "/" + SOURCE.path;
const REPO_URL = "https://github.com/ryandotelliott/capy-pstack";
const COMMAND = "node scripts/generate.mjs";
const ADAPTER_SKILL = "pstack-capy";
const ADAPTER_DESCRIPTION =
  "Capy adapter for the pstack skills. Read it once per thread before you follow any pstack skill, such as poteto-mode, setup-pstack, arena, swarm, or interrogate. It maps their Cursor tool, subagent, model, path, and feature names to Capy.";
const LINK = /\]\(([^)\s]+)\)/g;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Each key must appear in adapter/capy.md. A skill whose text matches a term gets the adapter line under its H1.
const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call|spawn)/ },
  { key: "`AskQuestion`", re: /AskQuestion/ },
  { key: "todolist", re: /\btodo ?list\b/i },
  { key: "generalPurpose", re: /generalPurpose/ },
  { key: "poteto-agent", re: /poteto-agent/ },
  { key: "comment-sicko", re: /comment-sicko/ },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask|readonly strips/ },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/ },
  { key: "cloud_base_branch", re: /cloud_base_branch/ },
  { key: "`run_in_background: true`", re: /run_in_background/ },
  { key: "`resume`", re: /`resume`/ },
  { key: "`file_attachments`", re: /file_attachments/ },
  { key: "claude-", re: /\bclaude-[a-z]+-\d/ },
  { key: "gemini-", re: /\bgemini-\d/ },
  { key: "grok-", re: /\bgrok-\d/ },
  { key: "gpt-", re: /\bgpt-\d/ },
  { key: "inherit-parent", re: /inherit-parent/ },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/ },
  { key: ".cursor/skills/", re: /\.cursor\/skills/ },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/ },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/ },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/ },
  { key: "Bugbot", re: /Bugbot/ },
  { key: "Cursor Automations", re: /Cursor [Aa]utomation|cursor\.(sh|com)\/automations|update_state|SendToUser/ },
  { key: "cloud agents", re: /[Cc]loud [Aa]gent/ },
  { key: "Project workers", re: /Project worker|Cursor Projects?\b/ },
  { key: "built-in PR tool", re: /built-in PR tool|gh pr create/ },
  { key: "built-in babysit skill", re: /built-in babysit/ },
  { key: "cursor-team-kit", re: /cursor-team-kit|\/deslop|control-ui|control-cli/ },
];
const ROUTE_KEY = "Run another pstack skill";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function file(path) {
  return { bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 };
}

const skills = readdirSync(SKILLS).filter((name) => existsSync(join(SKILLS, name, "SKILL.md")));
const adapter = readFileSync(ADAPTER, "utf8");
const problems = [];
if (skills.includes(ADAPTER_SKILL)) problems.push("upstream already has a skill named " + ADAPTER_SKILL);

const users = new Map();
const wrapped = new Set();
for (const skill of skills) {
  const dir = join(SKILLS, skill);
  const others = skills.filter((name) => name !== skill).join("|");
  const route = new RegExp("the \\*\\*(?<bold>" + others + ")\\*\\* skill|`/(?<command>" + others + ")`", "g");
  const namesBareSkill = (line) =>
    [...line.matchAll(route)].some(({ groups }) => !line.includes("(../" + (groups.bold ?? groups.command) + "/"));
  const keys = new Set();
  for (const path of walk(dir).filter((path) => path.endsWith(".md"))) {
    const text = readFileSync(path, "utf8");
    for (const term of TERMS) if (term.re.test(text)) keys.add(term.key);
    if (text.split("\n").some(namesBareSkill)) keys.add(ROUTE_KEY);
  }
  const text = readFileSync(join(dir, "SKILL.md"), "utf8");
  if (keys.size > 0) {
    if (/^# /m.test(text)) wrapped.add(skill);
    else problems.push("skills/" + skill + "/SKILL.md uses Cursor names but has no H1");
  }
  for (const key of keys) users.set(key, [...(users.get(key) ?? []), skill]);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  const description = frontmatter.match(/^description:(.*)$/m)?.[1].trim() ?? "";
  if (name !== skill) problems.push("skills/" + skill + "/SKILL.md has name " + JSON.stringify(name ?? "") + ", not its folder name");
  if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push("skills/" + skill + " is not a valid Capy skill folder name");
  if (!description) problems.push("skills/" + skill + "/SKILL.md has no description, so Capy would skip it");
  if (description.length > 1024) problems.push("skills/" + skill + "/SKILL.md has a description over 1,024 characters, which rejects the plugin");
}
for (const [key, using] of users) {
  if (!adapter.includes(key)) problems.push("adapter/capy.md has no row for " + key + ", used by " + using.join(", "));
}
for (const problem of problems) console.log("FAIL " + problem);
if (problems.length > 0) process.exit(1);

// Where each upstream path lands in the plugin. Capy copies only skills/ to a machine, so everything else
// the skills read at runtime moves into the adapter skill's references/.
function place(path) {
  if (path.startsWith("skills/")) return path;
  if (path.startsWith("agents/")) return "skills/" + ADAPTER_SKILL + "/references/" + path;
  if (path.startsWith("docs/guide/") || path === "docs/guide") return "skills/" + ADAPTER_SKILL + "/references/guide" + path.slice("docs/guide".length);
  if (path === "README.md" || path === "LICENSE") return "skills/" + ADAPTER_SKILL + "/references/" + path;
  return undefined;
}

function resolve(from, href) {
  const target = href.replace(/[#?].*/, "");
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return undefined;
  const path = posix.join(posix.dirname(from), target).replace(/\/$/, "");
  if (path.startsWith("..")) return undefined;
  return existsSync(join(PSTACK, path)) ? path : undefined;
}

function render() {
  const sources = [
    ...walk(SKILLS),
    ...walk(join(PSTACK, "agents")),
    ...walk(join(PSTACK, "docs", "guide")),
    join(PSTACK, "README.md"),
    join(PSTACK, "LICENSE"),
  ].map((path) => relative(PSTACK, path).split("\\").join("/"));
  const files = new Map();
  const line =
    "In Capy, read [the pstack-capy adapter](../" + ADAPTER_SKILL + "/SKILL.md) once per thread before you follow this skill. " +
    "It maps the Cursor names in pstack skills to Capy.";
  for (const source of sources) {
    const entry = file(join(PSTACK, source));
    const out = place(source);
    if (source.endsWith(".md")) {
      let text = entry.bytes.toString("utf8").replace(LINK, (link, href) => {
        const target = resolve(source, href);
        if (!target) return link;
        const suffix = href.slice(href.search(/[#?]|$/));
        const landed = place(target);
        if (landed) return "](" + (posix.relative(posix.dirname(out), landed) || posix.basename(landed)) + suffix + ")";
        const kind = statSync(join(PSTACK, target)).isDirectory() ? "tree" : "blob";
        return "](" + UPSTREAM_URL.replace("/blob/", "/" + kind + "/") + "/" + target + suffix + ")";
      });
      const skill = source.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1];
      if (skill && wrapped.has(skill)) text = text.replace(/^(# .*)\n+/m, "$1\n\n" + line + "\n\n");
      entry.bytes = Buffer.from(text);
    }
    files.set(out, entry);
  }
  const body = adapter.replace(/^---\n[\s\S]*?\n---\n+/, "");
  const skillFile = "---\nname: " + ADAPTER_SKILL + "\ndescription: " + ADAPTER_DESCRIPTION + "\n---\n\n" + body;
  files.set("skills/" + ADAPTER_SKILL + "/SKILL.md", { bytes: Buffer.from(skillFile), executable: false });

  const upstream = JSON.parse(readFileSync(join(PSTACK, "plugin.json"), "utf8"));
  const manifest = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: upstream.name,
    version: upstream.version,
    description: upstream.description,
    author: upstream.author,
    homepage: REPO_URL,
    repository: REPO_URL,
    license: upstream.license,
    keywords: upstream.keywords,
    extensions: { "ai.capy": { displayName: "pstack" } },
  };
  const json = (value) => ({ bytes: Buffer.from(JSON.stringify(value, null, 2) + "\n"), executable: false });
  files.set("plugin.json", json(manifest));
  files.set("mcp.json", json({ $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", mcpServers: {} }));
  files.set("LICENSE", file(join(PSTACK, "LICENSE")));
  const readme =
    "# pstack for Capy\n\nThis folder is the Capy plugin. It is generated from `upstream/pstack` (cursor/plugins@" + SOURCE.commit.slice(0, 7) +
    ") and `adapter/capy.md` by `" + COMMAND + "`. Do not edit it by hand.\n\nSee the [repository README](../README.md) for install and update steps.\n";
  files.set("README.md", { bytes: Buffer.from(readme), executable: false });
  return files;
}

const files = render();
const dangling = [];
for (const [path, entry] of files) {
  if (!path.endsWith(".md") || path === "README.md") continue;
  for (const [, href] of entry.bytes.toString("utf8").matchAll(LINK)) {
    const target = href.replace(/[#?].*/, "");
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) continue;
    const landed = posix.join(posix.dirname(path), target).replace(/\/$/, "");
    const exists = files.has(landed) || [...files.keys()].some((key) => key.startsWith(landed + "/"));
    if (!exists) dangling.push("plugin/" + path + " links to " + href + ", which is not in the plugin");
  }
}
for (const link of dangling) console.log("FAIL " + link);
if (dangling.length > 0) process.exit(1);

if (process.argv.includes("--check")) {
  const onDisk = new Map(existsSync(OUT) ? walk(OUT).map((path) => [relative(OUT, path).split("\\").join("/"), file(path)]) : []);
  const drifted = [...new Set([...files.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [files.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log("plugin/" + path);
  if (drifted.length > 0) {
    console.log("plugin/ is out of date. Run `" + COMMAND + "` and commit the result.");
    process.exit(1);
  }
  console.log("plugin/ is up to date.");
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of files) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  console.log(skills.length + " skills plus " + ADAPTER_SKILL + ", " + wrapped.size + " SKILL.md files with the adapter line, " + files.size + " files");
}
