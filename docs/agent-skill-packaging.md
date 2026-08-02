# Cross-agent Skill packaging

Research date: 2026-08-02

This note records how the `faux-ui` and `faux-ui-grid` Agent Skills are each authored once and distributed with `@faux-ui/ui` and `@faux-ui/grid` to Pi, OpenAI Codex/ChatGPT, Claude Code, and other Agent Skills-compatible hosts.

## Conclusion

`package.json#pi` is Pi-specific:

```json
{
  "pi": {
    "skills": ["./skills"]
  }
}
```

The skills themselves are not Pi-specific. `packages/ui/skills/faux-ui/SKILL.md` and `packages/grid/skills/faux-ui-grid/SKILL.md` follow the open Agent Skills format used by Pi, Codex, and Claude Code.

There is no universal `package.json` field that activates an installed npm package in every agent. Each host has its own discovery or plugin manifest:

| Host | Direct skill discovery | Packaged distribution |
| --- | --- | --- |
| Pi | `.agents/skills/`, `.pi/skills/`, user skill directories | `package.json#pi.skills` or conventional `skills/` in a Pi package |
| Codex / ChatGPT | `.agents/skills/`, `~/.agents/skills/` | `.codex-plugin/plugin.json` and a plugin marketplace/directory |
| Claude Code | `.claude/skills/`, `~/.claude/skills/` | `.claude-plugin/plugin.json` and a Claude plugin marketplace |
| Other compatible agents | Host-defined skill directory | Host-defined; the canonical `SKILL.md` remains reusable |

A normal `npm install` only puts files in `node_modules`; it does not automatically enable them in Codex or Claude Code.

## Selected package layout

Each publishable package keeps one canonical skill and adds only thin host metadata:

```text
packages/<package>/
├── package.json
├── .codex-plugin/
│   └── plugin.json
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── <skill-name>/
        └── SKILL.md
```

The foundation uses package/skill names `ui` / `faux-ui`; the extension uses `grid` / `faux-ui-grid`.

Do not copy the skill body into `.agents/skills/` and `.claude/skills/` inside the package. Those directories are installation locations, not canonical publication sources. Duplicating the file would create drift.

## Shared Agent Skills contract

A portable skill is a directory containing `SKILL.md` with YAML frontmatter and Markdown instructions.

Required standard fields:

- `name`: lowercase letters, digits, and hyphens; maximum 64 characters; matches the parent directory;
- `description`: non-empty, maximum 1024 characters, and explains both capability and activation conditions.

Useful optional standard fields:

- `license`;
- `compatibility`;
- `metadata`;
- experimental `allowed-tools`.

Optional subdirectories include `scripts/`, `references/`, and `assets/`. Both faux-ui skills are instruction-only and do not need executable scripts, hooks, MCP servers, or pre-approved tools.

All hosts use progressive disclosure: name and description are indexed first; the complete `SKILL.md` is loaded only when selected.

## Pi

Pi recognizes the `pi` key in an npm package manifest. With the published package, installation can be:

```bash
pi install npm:@faux-ui/ui
pi install npm:@faux-ui/grid
```

Pi also discovers conventional `skills/` directories and direct skills under project/user `.agents/skills/` locations. The explicit manifest is retained because it declares package intent and participates in Pi package filtering.

The Pi field is ignored by npm, Codex, Claude Code, and other consumers.

## OpenAI Codex and ChatGPT

Codex directly scans Agent Skills from `.agents/skills/` between the working directory and repository root, plus `~/.agents/skills/` and managed locations.

For distributable packages, OpenAI uses a plugin manifest at:

```text
.codex-plugin/plugin.json
```

The manifest identifies the plugin and points `skills` to `./skills/`. OpenAI plugin marketplaces can reference local, Git, or npm-backed plugin sources. An npm marketplace entry downloads the package without running lifecycle scripts. Public plugins can be submitted to the universal directory shared by ChatGPT and Codex.

An individual skill may also contain optional `agents/openai.yaml` metadata for display assets, implicit-invocation policy, and tool dependencies. The faux-ui skills do not need it: their standard descriptions are sufficient, they have no tool dependency, and keeping host UI metadata out preserves the smallest portable skills.

A direct project-local installation can instead link the canonical skill:

```bash
mkdir -p .agents/skills
ln -s "$PWD/node_modules/@faux-ui/ui/skills/faux-ui" \
  .agents/skills/faux-ui
# Use @faux-ui/grid/skills/faux-ui-grid for the optional Grid skill.
```

That link is a consumer action; it should not be created by npm lifecycle scripts.

## Claude Code

Claude Code directly scans skills from `.claude/skills/` in project/parent locations and from `~/.claude/skills/` for personal use.

Reusable distribution uses a Claude plugin manifest at:

```text
.claude-plugin/plugin.json
```

Claude plugins discover `skills/<name>/SKILL.md` at the plugin root. The package can be tested directly after installation:

```bash
claude --plugin-dir ./node_modules/@faux-ui/ui
# Add --plugin-dir ./node_modules/@faux-ui/grid when Grid is installed.
```

A standalone project-local alternative is:

```bash
mkdir -p .claude/skills
ln -s "$PWD/node_modules/@faux-ui/ui/skills/faux-ui" \
  .claude/skills/faux-ui
# Use @faux-ui/grid/skills/faux-ui-grid for the optional Grid skill.
```

Marketplace distribution should point at the relevant plugin root (`packages/ui` or `packages/grid` in the repository, or the equivalent packaged artifact). Plugin skills are namespaced by the plugin name in Claude Code.

## Why retain three declarations

The three declarations solve different host-level discovery problems while sharing one skill body:

- `package.json#pi.skills` lets `pi install npm:...` discover resources;
- `.codex-plugin/plugin.json` makes the package an OpenAI plugin;
- `.claude-plugin/plugin.json` makes the package a Claude Code plugin;
- each package's `skills/<name>/SKILL.md` remains its portable source of truth.

The manifests should contain no host behavior, prompts, or duplicated instructions. They only identify the package and locate the shared skill.

## Versioning and publication checks

For each release:

1. Keep npm package version, Codex plugin version, Claude plugin version, and exported `VERSION` synchronized.
2. Include `.codex-plugin`, `.claude-plugin`, and `skills` in `package.json#files`.
3. Validate that the packed tarball contains both manifests and the canonical skill.
4. Validate Agent Skills frontmatter, including directory/name equality (`skills-ref validate skills/faux-ui` or `skills-ref validate skills/faux-ui-grid`).
5. Preserve UI browser/TUI subpath isolation and reject every internal UI import from the packed Grid extension.
6. Typecheck and run the packed UI/Grid consumer.
7. Do not use install scripts to modify a consumer's agent settings or skill directories.

## Security

Skills are instructions with the same practical authority as the host agent. Plugins may additionally carry executable hooks, scripts, MCP servers, or tools. Consumers must review third-party packages before enabling them.

Both faux-ui packages intentionally ship only documentation-style skill instructions and static plugin metadata. They do not add hooks, executable skill scripts, MCP servers, or automatic installation side effects.

## Official references

### Agent Skills

- [Agent Skills specification](https://agentskills.io/specification)
- [Integrating Agent Skills](https://agentskills.io/integrate-skills)
- [`skills-ref` validation library](https://github.com/agentskills/agentskills/tree/main/skills-ref)

### Pi

- [Pi Skills documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Pi Packages documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)

### OpenAI Codex and ChatGPT

- [Build skills](https://developers.openai.com/codex/skills)
- [Package plugins](https://developers.openai.com/plugins/build/plugins)
- [OpenAI skill examples](https://github.com/openai/skills)
- [OpenAI plugin examples](https://github.com/openai/plugins)
- [Codex plugin manifest specification](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md)

### Claude Code

- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Create Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Discover and install Claude Code plugins](https://code.claude.com/docs/en/discover-plugins)
- [Claude Code plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Anthropic skill examples](https://github.com/anthropics/skills)
