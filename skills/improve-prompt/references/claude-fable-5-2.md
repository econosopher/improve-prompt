# Claude Fable 5.2

- Model: `claude-fable-5-2`
- Verified: 2026-11-10
- Basis: official model-specific guidance; not a measured improvement claim for this skill.
- Source: [Anthropic's Fable 5.2 prompting guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2)

Apply only when relevant:

- For long tasks, clarify the completion condition and how to handle ordinary
  recoverable obstacles. Preserve deliberate blockers and explicit approval gates.
- Name the actions already authorized and the actions requiring approval;
  repeated vague caution can cause unnecessary stops.
- For code changes, explain the actual ownership and requested scope without
  granting permission to fix unrelated code.
- Request useful progress updates for lengthy work. Constrain delegation to
  the user's needs instead of automatically adding subagents.
- Review inherited instructions for unnecessary work; change one behaviour at
  a time and compare task quality, cost and completion.

Settings, only if asked: Anthropic recommends `high` as a starting point and
evaluating other effort levels on the actual workload. A rewritten prompt does
not set effort. Do not rewrite stored API history or system prefixes to apply
this profile mid-session; use a new conversation for changed system instructions.
