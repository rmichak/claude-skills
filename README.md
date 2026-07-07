# claude-skills

A growing collection of [Claude Code](https://www.anthropic.com/news/claude-code) skills built by [Randy Michak](https://github.com/rmichak). Each skill is a self-contained directory with a `SKILL.md` (and sometimes supporting scripts or references) that Claude can invoke when its description matches what you're trying to do.

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

### [`seo-audit`](./seo-audit/) — Comprehensive SEO site audit

Runs a structured SEO audit across six categories: indexing (robots.txt, sitemap, canonicals), on-page (titles, meta, headings, alt text), technical (Core Web Vitals, HTTPS, redirects), schema/structured data, content quality, and security headers. Each category gets a /10 score and a prioritized list of fixes. Output is a markdown report saved to `_claude-output/seo-audit-[domain]-[date].md`.

- **Triggers:** "seo audit", "seo review", "check seo", "site audit", "search optimization"
- **Beyond auditing:** also handles keyword research guidance, on-page optimization, internal linking strategy, meta tag rewrites, and content gap analysis

### [`roast`](./roast/) — Pressure-test an idea before you build it

Claude's default is to agree with you; /roast is the opposite. It convenes a council of five adversarial persona agents (run in parallel) who tear an idea apart and rebuild it from every angle — market, money, execution, and more — then a Judge agent synthesizes everything into one honest verdict. Use it before you sink time and money into building the wrong thing.

- **Triggers:** "/roast \<idea\>", "roast this idea", "pressure-test this", "convene the council", "validate this business idea"
- **Requirements:** none — self-contained, uses only built-in Claude Code agents

### [`storm-research`](./storm-research/) — Multi-perspective, citation-verified research briefings

Turns one topic into a verified HTML briefing using a STORM-style pipeline: five expert lenses research the topic in parallel, contradictions between them get mapped, everything is synthesized into a single self-contained HTML report, then the output is adversarially peer-reviewed and every citation is verified against its primary source before delivery. Heavier than a quick lookup — that's the point.

- **Triggers:** "storm research this", "storm report on X", "give me a STORM briefing on X"
- **Requirements:** none — self-contained, uses built-in agents plus the bundled `report-template.html`
- **Best for:** topics where multiple viewpoints and fact-checked claims matter; overkill for a simple factual lookup

## Installation

Clone the repo and run the install script:

```bash
git clone https://github.com/rmichak/claude-skills.git
cd claude-skills
./install.sh
```

The script symlinks each skill directory into `~/.claude/skills/<name>/`. It's idempotent (re-running is safe) and refuses to overwrite a real directory at the destination — it'll only replace existing symlinks. To install just one skill:

```bash
./install.sh watch
```

To uninstall, remove the symlinks:

```bash
rm ~/.claude/skills/watch ~/.claude/skills/ai-text-detector ~/.claude/skills/humanizer ~/.claude/skills/seo-audit ~/.claude/skills/roast ~/.claude/skills/storm-research
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
