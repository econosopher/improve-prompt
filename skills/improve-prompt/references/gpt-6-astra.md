# GPT-6 Astra

- Model: `gpt-6-astra`
- Verified: 2026-11-10
- Basis: official Astra-specific guidance; not a benchmark result for this skill.
- Source: [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

Apply only when relevant:

- Prefer a concise outcome, context and constraints to an elaborate itinerary.
  Avoid duplicating instructions already doing useful work.
- Name what finished means for multi-step work, including requested validation
  or inspection. Avoid stopping at the first implementation when the user asked
  for a working result.
- State existing permission for specific routine work clearly. Preserve real
  approval requirements; do not weaken a boundary to encourage persistence.
- Limit required reading to the task. Avoid mandatory full-repository tours.
- Ask for proportionate verification. Repeated “check everything” instructions
  can cause redundant testing.
- Keep task-specific examples and operational constraints when they contribute
  to the result. Do not transfer Astra-specific assumptions to Sol or Luna.

Settings: model and reasoning effort belong to the host/API. Leave them unchanged
unless the user asks for advice or configuration work.
