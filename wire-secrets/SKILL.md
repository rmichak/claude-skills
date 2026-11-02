---
name: wire-secrets
description: Use when the user wants to connect a project to their central secret vault — phrasings like "wire up secrets", "set up secrets for this project", "use the vault here", "get this project off .env", or "push these secrets to Vercel/GitHub/AWS". Covers the bundled `secret` CLI (a macOS Keychain vault for API keys).
---

# Wiring a project to the `secret` vault

The `secret` CLI (bundled in this skill's `bin/`) centralizes API keys in the macOS Keychain,
with non-secret metadata in `~/.config/claude-secrets/registry.toml`. This skill connects a
project to it. **Core principle: reuse before regenerate** — never create a new key for a
service that's already in the vault.

## One-time install (macOS only — it uses the Keychain via `security`)

If `command -v secret` finds nothing, install it from this skill's folder:
```bash
mkdir -p ~/.local/bin ~/.config/claude-secrets
cp bin/secret ~/.local/bin/secret && chmod +x ~/.local/bin/secret      # ~/.local/bin must be on PATH
cp bin/doctor.sh ~/.config/claude-secrets/doctor.sh
[ -f ~/.config/claude-secrets/registry.toml ] || cp registry.example.toml ~/.config/claude-secrets/registry.toml
```
Set `CLAUDE_SECRETS_DIR` to use a different config folder. Run `secret help` for every command.

## Steps

1. **Scaffold the map.** From the project directory:
   ```bash
   secret init
   ```
   It scans `.env`/`.env.example`, and for each secret-like var either (a) reuses an
   existing vault entry if the value already matches one, (b) imports a genuinely new value,
   or (c) maps a placeholder to the conventional vault name without importing junk. It writes
   a committable `.secrets.map` (var → vault-name).

2. **Review the generated `.secrets.map`.** Fix any wrong guesses. Naming conventions:
   shared services get a bare name (`resend`, `elevenlabs`, `firecrawl`); per-project
   services get a namespace (`openrouter/<project>`, `aws/<project>`, `clerk/<project>`).
   AWS pairs are one `id:secret` blob split via `aws/<project>|id` and `|secret`.

3. **Fill any gaps.** For each var `secret init` flagged as placeholder/missing, run
   `secret ensure <name>` — it prints the vendor's create-URL if the key isn't stored yet.
   Store real values with `secret set <name>`. Add the service to `registry.toml` so
   `secret ensure` knows its create-URL and `secret doctor` can probe it. Confirm with
   `secret doctor` then `secret list`.

4. **Run through the vault (no plaintext on disk):**
   ```bash
   secret run -- <the project's dev/build command>
   ```
   Exception: Vite/Next auto-load `.env` themselves — for those, generate it from the vault
   with `secret env > .env` (keep `.env` gitignored).

5. **Deploying? Push to the platform's own store** (the Keychain is local-only and cloud
   runtimes can't read it). DRY-RUN first, then add `--yes`:
   ```bash
   secret push github   # -> gh secret set, repo from git remote
   secret push vercel   # -> Vercel env API, token from the vault entry "vercel"
   secret push aws      # -> AWS Secrets Manager, named <project>/<VAR>
   ```

## Rules
- Real key values go ONLY in the Keychain. `.secrets.map` and `registry.toml` hold names and metadata, never values — both are safe to commit.
- Before generating any new key, `secret ensure <service>`; reuse what exists.
- Never commit `.env` with live values; prefer `secret run --`.
- After importing/rotating, run `secret doctor` to refresh live/dead status.
