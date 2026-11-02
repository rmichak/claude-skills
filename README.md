# claude-skills

A growing collection of [Claude Code](https://www.anthropic.com/news/claude-code) skills built or adapted by [Randy Michak](https://github.com/rmichak) (adapted skills credit their source below). Each skill is a self-contained directory with a `SKILL.md` (and sometimes supporting scripts or references) that Claude can invoke when its description matches what you're trying to do.

## What's a skill?

A skill is a markdown file (`SKILL.md`) — plus optional scripts and reference docs — that tells Claude how to do a specific job well. When you have a skill installed at `~/.claude/skills/<name>/`, Claude Code can discover and invoke it automatically based on the description in its frontmatter. Skills are how you turn "I keep doing this same thing" into "Claude just does this thing now."

## Skills in this repo

### [`watch`](./watch/) — Watch a video

Give Claude a YouTube URL or local video file and ask questions about it. The skill downloads the video with `yt-dlp`, extracts auto-scaled frames with `ffmpeg`, pulls a transcript (native captions or Whisper API fallback), and hands frame paths to Claude so it can answer using both visual and spoken content.

- **Triggers:** "/watch \<url\>", pasting a video link with a question, asking Claude to summarize or analyze a video
- **Requirements:** `ffmpeg`, `yt-dlp`, optional Groq or OpenAI API key for Whisper fallback
- **More info:** [`watch/README.md`](./watch/README.md)

### [`ai-text-detector`](./ai-text-detector/) — Screen prose for AI-generation signals

For instructors grading written work. Reads student prose submissions (essays, reflections, READMEs, discussion posts) and produces a per-submission markdown review report estimating the likelihood of AI generation. Cites specific passages and frames findings as "signals to investigate," never as verdicts — false positives on ESL students and technical writers are a known failure mode of every heuristic detector, and this skill is built around that humility.

- **Triggers:** "check this for AI", "screen these essays", "is this AI-written", grading folders with student prose
- **Skips:** code-only submissions, anything under ~150 words (signals too sparse)

### [`humanizer`](./humanizer/) — Strip AI-writing tells from text

Edits text to remove patterns that mark it as AI-generated: inflated symbolism, em dash overuse, rule-of-three abuse, AI vocabulary words, "it's not X, it's Y" negation, throat-clearing openers, and ~25 other documented tells. Based on Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) guide. Includes a "VOICE PROFILE" section you can customize so the humanized output sounds like *you*, not like generic clean prose.

- **Triggers:** "humanize this", "make this sound less like AI", "remove AI tells from this draft"
- **Credit:** Adapted from [blader/humanizer](https://github.com/blader/humanizer) by Siqi Chen (MIT). The pattern catalog is his; this version adds a customizable voice profile. His license is included at [`humanizer/LICENSE`](./humanizer/LICENSE).

### [`seo-audit`](./seo-audit/) — Comprehensive SEO site audit

Runs a structured SEO audit across six categories: indexing (robots.txt, sitemap, canonicals), on-page (titles, meta, headings, alt text), technical (Core Web Vitals, HTTPS, redirects), schema/structured data, content quality, and security headers. Each category gets a /10 score and a prioritized list of fixes. Output is a markdown report saved to `_claude-output/seo-audit-[domain]-[date].md`.

- **Triggers:** "seo audit", "seo review", "check seo", "site audit", "search optimization"
- **Beyond auditing:** also handles keyword research guidance, on-page optimization, internal linking strategy, meta tag rewrites, and content gap analysis

### [`roast`](./roast/) — Pressure-test an idea before you build it

Claude's default is to agree with you; /roast is the opposite. It convenes a council of five adversarial persona agents (run in parallel) who tear an idea apart and rebuild it from every angle — market, money, execution, and more — then a Judge agent synthesizes everything into one honest verdict. Use it before you sink time and money into building the wrong thing.

- **Triggers:** "/roast \<idea\>", "roast this idea", "pressure-test this", "convene the council", "validate this business idea"
- **Requirements:** none — self-contained, uses only built-in Claude Code agents
- **Credit:** Adapted from the `/roast` idea-council skill by [Nate Herk](https://x.com/nateherk), introduced in his video [*I asked Claude Code to make me as much money as possible*](https://youtube.com/watch?v=iTY8Q449YNQ) (June 2026) and shared through his AI Automation Society community. The council personas, Judge verdict, and 48-hour test are his design.

### [`storm-research`](./storm-research/) — Multi-perspective, citation-verified research briefings

Turns one topic into a verified HTML briefing using a STORM-style pipeline: five expert lenses research the topic in parallel, contradictions between them get mapped, everything is synthesized into a single self-contained HTML report, then the output is adversarially peer-reviewed and every citation is verified against its primary source before delivery. Heavier than a quick lookup — that's the point.

- **Triggers:** "storm research this", "storm report on X", "give me a STORM briefing on X"
- **Requirements:** none — self-contained, uses built-in agents plus the bundled `report-template.html`
- **Best for:** topics where multiple viewpoints and fact-checked claims matter; overkill for a simple factual lookup
- **Credit:** The multi-perspective approach is inspired by [STORM](https://github.com/stanford-oval/storm) from Stanford OVAL. This skill is an independent Claude Code take on the idea and contains no STORM code.

### [`security-scanner`](./security-scanner/) — Authorized security scans with structured reports

Walks through port scanning, vulnerability detection, SSL/TLS analysis, web-app checks, and DNS reconnaissance against a target you're authorized to test, then writes up findings with severity ratings. Before any scan it confirms that you own or have written authorization for the target and that the scope is defined.

- **Triggers:** "security scan", "vulnerability scan", "pentest", "security audit on \<target\>"
- **Requirements:** `nmap`, `curl`, `openssl`; optionally `testssl.sh`, `sslscan`, `nuclei`. Only scan systems you own or have written permission to test.

### [`sonarqube-triage`](./sonarqube-triage/) — Triage SonarQube findings before "fixing" them

Makes Claude read the flagged code in context and state whether it agrees with each SonarQube finding before touching anything. Real problems get fixed; false positives and fixes that wouldn't improve the code get dismissed with a written justification, so you don't refactor working code just to silence a rule.

- **Triggers:** pasting SonarQube issues, "fix these Sonar findings", "triage this scan"

### [`update-docs`](./update-docs/) — Keep README.md and CLAUDE.md in sync with the code

Updates a project's README and CLAUDE.md when its functionality changes: new routes, components, schema changes, or features added or removed. It can also act as a "what does this app do" reader.

- **Triggers:** "update docs", "/update-docs", or proactively after API/schema/feature changes

### [`technical-review`](./technical-review/) — Accuracy review for technical and teaching content

Reviews tutorials, course material, blog posts, and docs for technical accuracy and currency. It checks version numbers, API syntax, security advisories, and whether each explanation is clear, and grades every issue by severity.

- **Triggers:** "review this", "check accuracy", "technical review", "fact check"

### [`react-router-reviewer`](./react-router-reviewer/) — Expert persona for React / React Router content

A senior frontend engineer persona who reviews React 18+ and React Router v6/v7 tutorials and docs. It catches invented APIs, deprecated patterns taught as current, and code that won't compile, and it quotes the exact line along with the fix.

- **Triggers:** reviewing React or React Router tutorial/documentation content

### [`wire-secrets`](./wire-secrets/) — One Keychain vault for every project's API keys

Bundles the `secret` CLI, a small bash tool that keeps API keys in the macOS Keychain instead of `.env` files. It scaffolds a committable `.secrets.map` (var → vault name) from a project's `.env`, reuses keys you already have instead of minting new ones, injects them at runtime with `secret run -- <cmd>`, probes key health with `secret doctor`, and pushes to GitHub, Vercel, or AWS Secrets Manager (dry-run first).

- **Triggers:** "wire up secrets", "get this project off .env", "push these secrets to Vercel/GitHub/AWS"
- **Requirements:** macOS (Keychain via `security`). See the one-time install steps in [`wire-secrets/SKILL.md`](./wire-secrets/SKILL.md); start from [`registry.example.toml`](./wire-secrets/registry.example.toml).

## Installation

Clone the repo and run the install script:

```bash
git clone https://github.com/rmichak/claude-skills.git
cd claude-skills
./install.sh
```

The script symlinks each skill directory into `~/.claude/skills/<name>/`. It's idempotent (re-running is safe), refuses to overwrite a real directory at the destination, and leaves alone any symlink that points somewhere other than this repo (your own customized copy) unless you pass `--force`. To install just one skill:

```bash
./install.sh watch
```

To uninstall, remove the symlinks that point into this repo:

```bash
for d in */; do l=~/.claude/skills/${d%/}; [ -L "$l" ] && [ "$(readlink "$l")" = "$PWD/${d%/}" ] && rm "$l"; done
```

## How skills work in Claude Code

Once installed, skills appear in Claude's available-skills list automatically. When you type a query that matches a skill's description, Claude invokes it via the `Skill` tool, which loads the skill's `SKILL.md` content as instructions. You can also explicitly invoke a skill by typing `/<name>` in Claude Code (e.g. `/watch <url>`).

Skills can include:
- A `SKILL.md` with YAML frontmatter (name, description, version, allowed-tools) and instruction body
- Supporting `scripts/` that the skill shells out to
- A `references/` directory with additional docs the skill can `Read`
- A `commands/` directory (for plugin-style installs) that registers slash commands

## Forking and customizing

Each skill is meant to be forked. The `humanizer` skill is the clearest example — its "VOICE PROFILE" section is intentionally generic so you can replace it with your own voice. The `watch` skill's frame-budget logic and `ai-text-detector`'s signal taxonomy are also good places to tune for your workflow.

If you build something useful on top of one of these, I'd love to see it.

## License

[MIT](./LICENSE) — copy, modify, redistribute. Attribution appreciated but not required.
