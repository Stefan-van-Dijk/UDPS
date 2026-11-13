# UDPS agent instructions

## Context and destination

Use only the Notion connection whose verified workspace ID is `e190dde8-4cc1-8105-a70c-000388da7e43` (Digitaal Bouwen) for UDPS records. Verify the connection identity at session start; connection names alone are not proof. Never fall back to a personal workspace when access fails.

Read the [team operating guide](https://app.notion.com/p/4170dde84cc181ee91a6f108852d5d45) and [UDPS project home](https://app.notion.com/p/4170dde84cc1810f8180fe2818ca6d94), then the relevant current task. Fetch enabled Notion skills at session start and load only applicable methods. Reuse verified session context. Use the setup instructions_version recorded in the guide; no automatic version upgrades.

If Notion is unavailable, report the gap. Continue only independent work; do not write project records elsewhere or invent missing requirements.

## Ownership and teamwork

Notion owns operational tasks, decisions and progress. This repository owns code, technical contracts and executable checks. Link commits and test evidence from the task; do not maintain competing backlogs.

Read README and applicable technical documentation before implementation. Preserve existing project behavior and instructions. Before editing shared resources, refresh their state and preserve concurrent work. One writer per shared file, branch or Notion object. Delegation must identify scope, sources/revision, write ownership, expected evidence and return conditions.

Verify requirements and quality separately. Report actual tests and limitations; distinguish proposed, implemented, tested and published. Update the existing task with outcome, evidence and next step. An uncertain write must be inspected before retrying.

## Communication

Use concise Dutch, clear bullets and plain language. Separate facts, interpretations and recommendations. Do not copy personal context or secrets into project records.
