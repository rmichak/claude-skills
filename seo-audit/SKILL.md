---
name: seo-audit
description: |
  Comprehensive SEO site audit covering indexing, on-page, technical, schema, content,
  and security headers. Scores each category /10 with actionable fix recommendations.
  Triggers on: "seo audit", "seo review", "check seo", "site audit", "search optimization"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - WebFetch
  - Bash
---

# SEO Audit Skill

Perform comprehensive SEO audits with scored categories and actionable recommendations.

## Audit Categories (each scored /10)

### 1. Indexing (robots.txt, sitemap, canonicals)
Check:
- [ ] robots.txt exists and is properly configured
- [ ] XML sitemap exists and is submitted to Search Console
- [ ] Canonical tags present on all pages
- [ ] No accidental noindex on important pages
- [ ] Meta robots directives are intentional
- [ ] Hreflang tags (if multilingual)

### 2. On-Page SEO
Check:
- [ ] Unique title tags on every page (under 60 chars)
- [ ] Meta descriptions on every page (under 160 chars)
- [ ] H1 tag — exactly one per page, includes primary keyword
- [ ] Heading hierarchy (H1 → H2 → H3, no skipping)
- [ ] Image alt text on all images
- [ ] Internal linking structure
- [ ] Keyword density (natural, not stuffed)
- [ ] URL structure (clean, descriptive, hyphenated)

### 3. Technical SEO
Check:
- [ ] Page load speed (Core Web Vitals targets)
- [ ] Mobile responsiveness
- [ ] HTTPS everywhere (no mixed content)
- [ ] Proper redirects (301 not 302 for permanent)
- [ ] No broken links (4xx errors)
- [ ] Clean HTML (no render-blocking resources)
- [ ] Lazy loading for images
- [ ] Minified CSS/JS

### 4. Schema / Structured Data
Check:
- [ ] JSON-LD format (preferred over microdata)
- [ ] Organization schema on homepage
- [ ] Article schema on blog posts
- [ ] BreadcrumbList for navigation
- [ ] FAQ schema where applicable
- [ ] LocalBusiness schema (if local business)
- [ ] Valid schema (test with Google's Rich Results Test)

### 5. Content Quality
Check:
- [ ] Unique, valuable content (not thin pages)
- [ ] Readability score appropriate for audience
- [ ] Target keywords present naturally
- [ ] Fresh content / regular updates
- [ ] Internal links between related content
- [ ] External links to authoritative sources
- [ ] No duplicate content across pages

### 6. Security Headers
Check:
- [ ] Content-Security-Policy (CSP)
- [ ] Strict-Transport-Security (HSTS)
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] Referrer-Policy
- [ ] Permissions-Policy

## Content SEO Capabilities

Beyond auditing, this skill can also:
- **Keyword research guidance** — identify primary/secondary keywords for a topic
- **On-page optimization** — optimize existing blog posts for target keywords
- **Internal linking strategy** — map content clusters and suggest link opportunities
- **Meta tag optimization** — write compelling title tags and meta descriptions
- **Content gap analysis** — identify topics competitors cover that you don't

## Output Format

```markdown
# SEO Audit: [Site Name]

**URL:** [site URL]
**Date:** [audit date]
**Overall Score:** [X/60]

| Category | Score | Status |
|----------|-------|--------|
| Indexing | X/10 | [emoji] |
| On-Page | X/10 | [emoji] |
| Technical | X/10 | [emoji] |
| Schema | X/10 | [emoji] |
| Content | X/10 | [emoji] |
| Security Headers | X/10 | [emoji] |

## Critical Issues
[numbered list — must fix]

## Warnings
[numbered list — should fix]

## Recommendations
[prioritized action items with code examples where applicable]

## What's Working Well
[positive findings to maintain]
```

Save audit report to `_claude-output/seo-audit-[domain]-[date].md`
