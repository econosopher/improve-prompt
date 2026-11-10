# GPT-6.1 Sol

- Model: `gpt-6.1-sol`
- Verified: 2026-11-10
- Basis: official model card plus this skill's general rewrite policy.
- Source: [GPT-6.1 Sol model card](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

Use the general rewrite workflow. This profile deliberately makes no claims
that Sol has Astra's exact approval, persistence or testing tendencies. Supply
the intended result, useful context and real constraints; retain necessary
procedure rather than stripping it merely because another model needs less.

When API settings are explicitly part of the request, the model card lists
`low`, `medium`, `high`, `xhigh` and `max` effort, with `medium` as default.
Tool calling requires the Responses API. Verify these controls again before
changing an integration. Do not insert API settings into ordinary task prose
or claim that a chat prompt changes them.

The source verifies model identity and capabilities, not a special prompting
recipe. Refresh this profile when specific official prompting guidance or
repeatable task evidence supports a narrower recommendation.
