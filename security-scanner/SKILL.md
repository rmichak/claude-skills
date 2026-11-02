---
name: security-scanner
description: |
  Automated security scanning for authorized targets. Port scanning, vulnerability detection,
  SSL/TLS analysis, web app checks, and DNS reconnaissance. Requires explicit authorization.
  Triggers on: "security scan", "scan this", "vulnerability scan", "pentest", "security audit on"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebSearch
  - WebFetch
---

# Security Scanner

Perform authorized security assessments with structured reporting.

> [!warning] AUTHORIZATION REQUIRED
> Before ANY scanning, confirm:
> 1. The user owns or has written authorization to test the target
> 2. The scope is clearly defined (IPs, domains, ports)
> 3. No third-party infrastructure will be affected unintentionally

## Scanning Phases

### Phase 1: Passive Reconnaissance
No direct contact with target — safe to run first:
- WHOIS lookup
- DNS record enumeration (A, AAAA, MX, TXT, NS, CNAME)
- Certificate transparency logs (crt.sh)
- Subdomain discovery via public sources
- Technology stack identification (via headers, public info)
- Shodan/Censys lookup (if available)

### Phase 2: Port Scanning (nmap)
```bash
# Quick top ports scan
nmap -sV --top-ports 1000 -T4 [target]

# Full TCP scan
nmap -sV -sC -p- -T4 [target]

# UDP top ports
nmap -sU --top-ports 100 -T4 [target]

# Service version + OS detection
nmap -sV -O -A [target]
```

### Phase 3: SSL/TLS Analysis
```bash
# Using openssl
openssl s_client -connect [target]:443 -servername [domain]

# Check certificate details
openssl s_client -connect [target]:443 | openssl x509 -noout -text

# If sslscan is available
sslscan [target]

# If testssl.sh is available
testssl.sh [target]
```

Check for:
- Certificate validity and expiration
- Certificate chain completeness
- Supported cipher suites (flag weak ones)
- Protocol versions (flag SSLv3, TLS 1.0, TLS 1.1)
- Known vulnerabilities (BEAST, POODLE, Heartbleed, ROBOT)
- HSTS header presence

### Phase 4: Web Application Checks
```bash
# HTTP headers analysis
curl -sI https://[target]

# Security headers check
curl -sI https://[target] | grep -iE '(strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy)'

# Directory/file discovery (if gobuster/dirb available)
gobuster dir -u https://[target] -w /usr/share/wordlists/common.txt

# Check for common misconfigurations
curl -s https://[target]/.env
curl -s https://[target]/.git/config
curl -s https://[target]/robots.txt
curl -s https://[target]/sitemap.xml
```

Check for:
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Information disclosure (server version, framework, debug mode)
- Default credentials on admin panels
- Directory listing enabled
- Exposed sensitive files (.env, .git, backups)
- CORS misconfiguration
- Cookie security flags (HttpOnly, Secure, SameSite)

### Phase 5: Vulnerability Detection
```bash
# If nuclei is available
nuclei -u https://[target] -severity critical,high,medium

# CVE checking against detected services
# (Use service versions from nmap to search for known CVEs)
```

### Phase 6: DNS Security
- Check for zone transfer vulnerability
- DNSSEC validation
- SPF, DKIM, DMARC records (email security)
- Dangling DNS records (subdomain takeover risk)

## Severity Ratings

| Level | Description | Action |
|-------|-------------|--------|
| **CRITICAL** | Actively exploitable, immediate risk | Fix immediately |
| **HIGH** | Exploitable with some effort | Fix within 24-48 hours |
| **MEDIUM** | Potential risk, needs attention | Fix within 1 week |
| **LOW** | Minor issue, best practice violation | Fix when convenient |
| **INFO** | Observation, no direct risk | Note for awareness |

## Output Format

```markdown
# Security Assessment: [Target]

**Target:** [IP/domain]
**Date:** [scan date]
**Scope:** [what was tested]
**Authorization:** [confirmed by owner]

## Executive Summary
[2-3 sentences on overall posture]

## Findings Summary
| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| Info | X |

## Detailed Findings

### [CRITICAL/HIGH] Finding Title
- **Description:** What was found
- **Evidence:** Scan output or proof
- **Impact:** What an attacker could do
- **Remediation:** How to fix it

[repeat for each finding]

## Recommendations (Prioritized)
1. [Most urgent fix]
2. [Next priority]
...

## Appendix: Raw Scan Output
[relevant scan outputs]
```

Save report to `_claude-output/security-scan-[target]-[date].md`
