# Kiroween 2026 — Hackathon Strategy

Sources (verified 2026-11-10): kiroween.devpost.com overview, /rules, /details/faqs.

## Key dates
| What | When (Pacific) |
|---|---|
| Submission period | Oct 30, 2026 9:00am – **Dec 4, 2026 2:00pm** |
| Credit request deadline (4,000 credits) | **Dec 1, 2026 12:00pm** (ID verification; allow 48 business hours) |
| Credit codes must be redeemed by | Dec 4, 2026 |
| Redeemed credits expire | Dec 31, 2026 11:59pm |
| Judging period | Dec 16, 2026 – Jan 29, 2027 → **live demo URL must stay up until then** |

## Category
**Costume Contest** — "Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function."
Also eligible to apply: **Best Student Project: Costume Contest** (all members students; LinkedIn, student email, year/degree, school), **Best Demo** (automatic), **Social Blitz** (#KiroweenHackathon26 at the *start* of the post), **Bonus Blog** (third-party blog, must mention Kiroween 2026).
A project wins one Overall *or* one Category prize, plus any number of bonus prizes.

## Judging
Stage One: pass/fail — fits the theme and reasonably applies the required tools (Kiro).
Stage Two: **five equally weighted criteria** (official wording):

| Criterion | Official question | How Deadline Defense maximises it |
|---|---|---|
| Potential Impact | Credible case for a real problem / real audience? Useful, intuitive, accessible? Would someone use it? | Real deadlines (Moodle/demo semester) drive enemies; study checkpoints from PDFs power attacks. Students procrastinate → game makes progress visible and urgent. Keyboard + reduced-motion support. |
| Technological Implementation | How thoroughly/skilfully is Kiro used? Thoughtful AI-dev strategy, variety of Kiro tools, deep understanding, experimentation | Specs (requirements→design→tasks) implemented by Kiro; steering docs; hooks (test-on-save, asset/lint checks); custom agent; MCP (Playwright/browser); property-based tests (fast-check) on game-balance rules. Honest KIRO_USAGE.md log. |
| Design | Complete, coherent product, not a PoC; intuitive, polished, intentional | One cohesive dark-fantasy art direction, onboarding by play, juicy combat feedback, no placeholder UI. |
| Innovation/Idea | Novel, differs from existing concepts; unusual tech/resources combined | Tower defense where *real* coursework is the enemy roster; Moodle → game bridge; PDF → study-question ammunition. |
| Presentation | Video shows end-to-end; pitch says problem/who/why; creative & memorable | <3-min YouTube script: hook in 10s, Moodle click-through, live combat, Kiro workflow segment. |

## Mandatory checklist
- [ ] Working app + public URL (free static hosting, e.g. GitHub Pages — needs approval before publishing)
- [ ] Public **GitHub** repo with all source, assets, instructions
- [ ] OSI license detectable in GitHub About section (MIT)
- [ ] `/.kiro` at repo root (specs, hooks, steering) — **never gitignored**
- [ ] Demo video < 3 min, public on YouTube, no copyrighted music/trademarks
- [ ] Text description of features
- [ ] Write-up on how Kiro was used (IDE/CLI, agents, hooks, specs, steering, MCP, PBT, powers)
- [ ] New project built in submission period; disclose any pre-existing code/data (Moodle demo data)
- [ ] Third-party assets/APIs used within their licenses

## Risks
- Headless Kiro (`--no-interactive`) officially needs `KIRO_API_KEY` → paid plans only. Promo credits on a free account work for the interactive CLI/IDE. See PROGRESS.md for the chosen workflow.
- Moodle migration must not block the game.
