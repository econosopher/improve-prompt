# Examples

These are synthetic examples. Output wording varies by model and host context.

## A small coding fix

Input:

```text
$improve-prompt for GPT-6 Astra: Fix the CSV parser for quoted commas. Run the affected tests. Do not deploy.
```

Observed rewrite in a Codex CLI acceptance run:

```text
Fix the CSV parser so commas inside quoted fields are treated as part of the field, not as separators. Run the affected tests and report the result. Do not deploy.
```

The skill returned the prompt and a short target/change note. It did not edit a
parser or run the requested tests. That work would require a separate request.

## A read-only diagnosis

Input:

```text
/improve-prompt for Fable 5.2: Diagnose the checkout timeout using the supplied logs. Explain the likely cause in three bullets. Do not edit code.
```

The acceptance run preserved diagnosis-only scope and three bullets, and added
log grounding and uncertainty handling. It did not inspect a real checkout or
change code. Long-running-agent guidance was unnecessary for this small request.

## Refresh without changes

```text
$improve-prompt refresh --check Fable 5.2
```

The skill consults current official guidance and reports what it would change.
It leaves the installed files untouched. Use `refresh Fable 5.2` to request an
update, or `refresh` to check all profiles.
