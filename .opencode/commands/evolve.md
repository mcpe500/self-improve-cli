---
description: evaluate the current setup and propose one safe self-improvement
agent: build
---

Use the self-improve skill.

1. Read the latest score from runs/latest/score.json if it exists.
2. Run the local evaluation script.
3. Identify one concrete failure mode.
4. Make one focused change only.
5. Re-run evaluation.
6. Write a short summary to runs/latest/proposal.md with:
   - baseline score
   - new score
   - what changed
   - why it should help
   - possible regression risk
