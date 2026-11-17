# dsh-group-rules-prompt

Injects a group chat's rule file into every **group-member session's** system prompt.
Each DSH session talks in exactly one place — a group session gets that group's rules, a
private session gets nothing. The rules live in a plain Markdown file you edit; no restart
needed, the next turn picks it up.

## What it does

- Registers one system-prompt section: `group-rules`, order `645`, `interpolate: false`.
- On each prompt assembly, resolves the calling session id → the room it belongs to → that
  room's rules file, and renders:

  ```
  # 群聊规则（<room name>）

  <two lines of framing>

  <the rules file, verbatim>
  ```

- Injects nothing when: the session is not a group member, the file is missing or empty,
  `state.json` cannot be read/parsed, or the plugin is disabled. Every failure path returns
  an empty string — the plugin never throws into prompt assembly.

## Requirements

- DSH desktop runtime with the `systemPrompt` service (host ≥ the version that ships
  `ds-bot/src/host/prompt.js` section registration).
- A bot home: `$DSH_HOME` (defaults to `%USERPROFILE%\.dsh`), with `bot/state.json` present.

## Install

Local, linked into the profile (same shape as `dsh-handoff-relay`):

```bash
cd <克隆目录>
npm link                     # or: npm pack  → install the tarball
dsh plugin --profile desktop add dsh-group-rules-prompt
```

Restart the app once after installing; enabling/disabling the component afterwards only
needs a toggle in **插件 → 已安装 → 包含的组件**.

## Configuration

| key | default | meaning |
| --- | --- | --- |
| `enabled` | `true` | master switch; `false` renders nothing |
| `defaultFile` | (none) | absolute path of the rules file used for every group |
| `fileByRoom` | `{}` | per-room override: `{ "<roomId>": "<path>" }` |
| `maxChars` | `20000` | hard cap on the rendered block; longer text is cut with a note |
| `refreshMs` | `2000` | how often `state.json` is re-stat'ed (rules files always re-read on mtime change) |

Example `cordis.patch.yml` fragment (the file this bundle ships already inserts the plugin;
this is what the options look like):

```yaml
- insert:
    - id: dsh-group-rules-prompt
      name: dsh-group-rules-prompt
      config:
        defaultFile: C:/Users/you/.dsh/bot/workspace/GROUP-RULES.md
        maxChars: 20000
```

## Where the rules file lives

Any path you can read. The project convention is the bot workspace:
`~/.dsh/bot/workspace/GROUP-RULES.md`. Keep it to hard constraints only — it is injected on
every single turn, so it is billed as input tokens every time.

## Usage: move the rules out of the notice

A group `notice` has a 2000-character cap, and it is re-sent inside the **user** message on
every turn, so its whole length is billed every round. This plugin lets the rules live in the
system prompt instead: injected once, cached as a prefix, never re-sent per turn.

1. Put the full text in the rules file (`defaultFile`), e.g.
   `~/.dsh/bot/workspace/GROUP-RULES.md`.
2. Shrink the group notice to a one-line pointer, e.g.
   `群规则已作为系统提示词注入；全文见 GROUP-RULES.md，修订以该文件为准。`
   The pointer is pasted by a human — this plugin never writes the notice.
3. Restart DSH once. Later edits to the rules file take effect on the next turn (mtime based):
   no restart, no notice edit.

## Migration template: `rules.example.md`

The repository ships a ready-made starting point, `rules.example.md`, so you do not have to
author the rules file from scratch:

- Its body is the hard constraints of one real group's `notice`, carried over item by item —
  no omissions, no new wording invented by this plugin.
- It adds the three day-to-day practices that used to live only in group memory (read the
  ledger once per round, `@` only those who must act, paste the body in the group when it
  fits), plus the exceptions that go with them.
- Treat it as a template, not as gospel: copy it to the path you configured (`defaultFile`),
  replace the group name and the file paths it mentions with your own, then keep editing your
  copy. The shipped file is never read at runtime.

```bash
cp rules.example.md ~/.dsh/bot/workspace/GROUP-RULES.md
```

Then shrink the notice to the one-line pointer as described above. Nothing in the template is
machine-specific except the examples it quotes — check those paths before you rely on them.

## Boundaries

- **Does not touch the group notice.** Replacing its text with a pointer is a human action.
- **Does not change any configuration for you** — not the notice, not another plugin's watches,
  not host settings.
- Read-only towards `state.json`; no network calls; session ids are never logged.
- Uninstalling is the rollback: the section disappears, the rules stop being injected, and a
  notice restored by hand gives the previous behaviour back.

## How the room is resolved

`state.json` → `rooms[roomId]`:

- `rooms[*].sessions[botId] === agentId` — the normal case; the map's **value** is the
  session id, so compare against the value, not the key.
- `rooms[*].parts[].sessionId === agentId` — fallback for older room records.

First match wins. No match ⇒ private/standalone session ⇒ no injection.

## Safety

- Read-only: never writes `state.json`, never touches the notice, never calls the network.
- Caches are keyed by path with `mtime + size` (rules file) and `refreshMs` (state.json);
  `clearCache()` is exported for tests.
- No session ids, paths or secrets are logged.

## Tests

```bash
node --test lib/index.test.mjs
```

14 cases: hit / unnamed room / non-group session / `parts[]` fallback / missing file /
broken `state.json` / mtime invalidation / TTL throttling / truncation / config defaults /
`enabled: false` / empty rules / section name+order / `apply()` degrade path.

## License

MIT
