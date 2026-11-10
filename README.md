# Improve Prompt

A portable skill for Claude Code and Codex that rewrites a rough request for its
intended model. It returns a prompt you can review and copy; it does not run the
task inside that prompt.

## Use it

In Claude Code:

```text
/improve-prompt Summarize the attached report in three bullets for the product lead.
```

In Codex, select **Improve Prompt** in the skill picker, or type:

```text
$improve-prompt
Fix the CSV parser for quoted commas. Run the affected tests. Do not deploy.
```

To target a different model:

```text
/improve-prompt for Fable 5.2:
Diagnose the checkout timeout using these logs. Do not edit code.
$improve-prompt for GPT-6 Astra:
Fix the CSV parser for quoted commas. Do not deploy.
```

The response contains one copyable prompt, the target model and a brief change
note. Ask for **just the prompt** to omit the notes. If an essential requirement
is ambiguous, the skill asks a focused question. It keeps ordinary tasks short.
Host or workspace approval policies still apply; approval already given should
be honoured. It never grants permission to perform the embedded task.

## Install

Clone this repository into a local development folder outside cloud-synced
storage. It has no Python or Node dependencies, API key requirement, or background
service. Your host's normal model usage still applies.

```sh
git clone https://github.com/econosopher/improve-prompt.git
cd improve-prompt
```

Copy or symlink the **entire** `skills/improve-prompt` folder to the appropriate
user skill directory. Preserve any existing installation instead of overwriting it.

| Host | User-level destination |
| --- | --- |
| Claude Code | `~/.claude/skills/improve-prompt/` |
| Codex | `~/.agents/skills/improve-prompt/` |

Codex installations that already use `~/.codex/skills/` can use that supported
directory instead. Install in one Codex location, not both. Start a fresh chat
after installation. In Claude Code, type `/improve-prompt`; in Codex, type `$`
and select the skill. A plugin bundle may add its namespace to the skill name.

This package targets Claude Code and Codex. Regular Claude chat and other skill
hosts may require their own upload/install flow; those interfaces are not tested
by this release. An optional Claude composer button is included; see below.

## Claude composer button

Install the optional mod using Claude Code's plugin manager:

```sh
claude plugin marketplace add econosopher/improve-prompt
claude plugin install improve-prompt@improve-prompt
```

Open a fresh Claude Code session. Type your draft, click **Improve** above
it, then review the replacement in the composer. **Undo** restores the original
until you edit again. The controls share one compact row, and Undo leaves no
status message behind. Errors clear when you edit or click **Dismiss**. The mod
never presses Send. In the terminal, press Ctrl+X,
then Tab to focus the button; press Enter to activate it. Tab moves to Undo.

It uses the current session's model and credentials. Your normal model usage
applies. Typing or sending while a rewrite runs discards its result. **Cancel
rewrite** keeps the draft but does not cancel provider billing for the request.
Failures and essential ambiguities leave the draft in place.

Only the draft and saved guidance go to the rewrite call. Conversation history
and attachments are not read. Exact known model IDs use saved profiles; other
versions use general guidance, shown in a brief notification after a rewrite. Use the skill command
for an explicit target-model override or guidance refresh.

The button rereads the skill and its model-routing table on every click. To share
guidance with an existing installation, set the plugin’s optional
`guidanceDirectory` to that skill folder’s absolute path using
`claude plugin configure improve-prompt@improve-prompt`. Leave it empty to use
the bundled copy. Reload plugins after changing configuration.

If another mod hides the button, its AbovePrompt handler must compose the result
of `await next(e)` with its own controls. A handler that returns without calling
`next` can hide later mods. Your existing status line can remain visible.

Live rewrite and Undo tests passed in Claude Code CLI 2.1.318 and the desktop
Code tab using engine 2.1.317. Edits during a pending desktop rewrite were kept.
Regular Claude chat is outside this mod's scope. No equivalent supported Codex
composer read/replace API has been verified, so Codex retains the native skill
picker and copyable rewrite.

To disable the button: `claude plugin disable improve-prompt@improve-prompt`.
This does not delete the standalone skill or its model guidance.

## Model guidance and refresh

Initial profiles cover **Claude Fable 5.2**, **GPT-6 Astra**, and **GPT-6.1 Sol**.
Each records its official sources, verification date and evidence limits.

The explicit target takes precedence over the rewriting model. Without an
override, the skill uses an exact model ID from trusted live session context if
the host supplies one. Otherwise it says **current model unverified** and uses
general guidance. It does not guess from an application name or saved default.

```text
/improve-prompt refresh --check Fable 5.2
$improve-prompt refresh GPT-6 Astra
```

`refresh --check` checks current official sources and proposes changes without
writing. `refresh` updates the installed guidance, subject to the owning
repository's policy. Omit the model to check all existing profiles. Refresh
requires web access and an update requires write access. Ordinary rewrites use
saved guidance and need neither. A source failure preserves the last verified
profile. Refresh does not change the active model, global settings or publish
anything. Pulling an upstream update is separate; keep local customizations in
your own branch or fork.

## What it improves

- Clear outcomes, useful context, material constraints and output shape.
- Model-specific adjustments where the evidence applies.
- Explicit completion criteria for substantial tasks.
- Preservation of scope, approvals, facts and uncertainty.

It avoids unnecessary reasoning choreography, mandatory delegation, invented
facts, and importing unrelated private context. Effort settings remain separate
from prompt wording. Better wording is not a guarantee of better task results.

See [acceptance cases](skills/improve-prompt/references/acceptance.md),
[validation notes](VALIDATION.md), and [examples](examples.md).

## Sources and inspiration

This is an original, small implementation informed by provider guidance and
existing approaches, including [Fabric's improve_prompt](https://github.com/danielmiessler/Fabric/blob/main/data/patterns/improve_prompt/system.md),
[Daniel Miessler's Prompting skill](https://github.com/danielmiessler/LifeOS/blob/main/LifeOS/install/skills/Prompting/SKILL.md),
and [prompt-master](https://github.com/nidhinjs/prompt-master). Their code and
templates are not bundled. Provider references are linked in each model profile.

MIT licensed. Contributions should preserve intent, keep profiles source-backed,
and test observable behaviour instead of matching exact output wording.

## Verify the adapter

With Node.js installed, run `node --test tools/tests/improve_prompt_composer.test.mjs`.
With Claude Code installed, run `claude plugin validate skills/improve-prompt`.
Neither test command needs an API key. See [VALIDATION.md](VALIDATION.md) for live
test coverage and its limits.
