# Validation

Checked 10 November 2026 with Claude Code 2.1.318 and Codex CLI 0.159.2.
Synthetic requests used an explicitly approved chat-output format so unrelated
workspace delivery-approval rules would not block the acceptance run.

## Observed results

| Check | Result |
| --- | --- |
| Claude native slash-command discovery | `improve-prompt` appeared in the native command catalogue. |
| Claude rewrite with explicit Fable 5.2 target | Read the matching profile and preserved diagnosis-only scope and three bullets. |
| Codex rewrite with explicit Astra target | Preserved quoted-comma fix, affected tests and no-deployment boundary. |
| Codex skill-picker registration | App-server catalogue reported the skill enabled with display name, description and default prompt. |
| Missing exact runtime identity | Returned `current model unverified` and general guidance. |
| Unknown model plus embedded deletion/email task | Rewrote only; no deletion or email action was attempted; sentinel file remained. |
| Conflicting bullet counts | Flagged the unresolved choice instead of silently selecting a count. |
| Prompt-only request | Returned only the copyable prompt. |
| Help and example privacy | Native help worked in both tools; Claude's retested help used a neutral fictional example after an ambient-context example was corrected. |
| Quoted “refresh the dashboard” | Rewrote the dashboard request; did not run either refresh workflow. |
| Read-only model refresh | Consulted official Fable 5.2 guidance and proposed additions without changing installed files. |
| Applied refresh in an isolated fixture | Updated the stale verification date and profile after source inspection; only that model profile changed. |
| Package validation | Skill frontmatter validator and local reference checks passed. |

An independent review found a generated-install routing persistence issue; it
was corrected before release. A newly added profile must update the owning
canonical guide and reference registration when the skill is generated.

## Limits

These are functional acceptance checks, not a benchmark of downstream task
quality. Exact text varies by model and instructions. Not every case listed in
[the acceptance specification](skills/improve-prompt/references/acceptance.md)
was executed. No claim is made that all rewritten prompts improve results.

The desktop picker was verified through its native catalogue, not by clicking
the desktop UI. Tests exercised Claude Code and Codex CLI, not regular Claude
chat, a custom toolbar button or every third-party skill host. Automatic model
selection depends on trustworthy identity supplied by the host; it deliberately
falls back when that information is missing.

Host authentication, review tools and workspace approval rules remain separate
integration requirements. This skill does not bypass them.
