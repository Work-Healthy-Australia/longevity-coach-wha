# New Mac dev setup — Janet Cares

A step-by-step setup checklist for turning a fresh macOS install into a Janet Cares dev machine. Written 2026-05-02 for James's MacBook Pro M5 (24 GB / 1 TB), but valid for any Apple Silicon Mac on macOS 15+.

Each step has the exact command to run plus a verify step. Work top to bottom — later steps assume earlier ones are done.

---

## 0. Before you power on

**Do NOT use Migration Assistant from the MacBook Air.** That machine had 411 GB used out of 460 GB, with iCloud Photos at 127 GB pinned locally and orphaned Time Machine snapshots holding deleted files. Migration Assistant would inherit all of it and you'd be back at square one within a week.

Plan: clean install, then pull files selectively. The setup below takes ~90 minutes and gives you a clean machine without legacy bloat.

What to bring across afterwards (selective, not bulk):
- SSH keys (`~/.ssh/`)
- GPG signing keys (export from Air, import on Pro)
- Project clones (re-clone from GitHub, don't copy)
- Specific files from `~/Documents` you actually use
- iCloud Drive content syncs automatically once signed in

What NOT to bring:
- `~/Library/Caches` (regenerate)
- `~/Downloads` (start fresh — most was duplicates anyway)
- Old `node_modules` directories (re-install per project)
- Old Xcode derived data
- Old Docker images / volumes
- Old Time Machine snapshots

---

## 1. macOS first-run

When you boot for the first time:

| Step | Choice |
|---|---|
| Apple ID | Sign in with your existing one (don't create new) |
| iCloud Drive | **ON** |
| iCloud Photos | **ON** |
| **Optimise Mac Storage** | **ON immediately** — keeps photo originals in iCloud, only previews local. The single most important setting to avoid the 127 GB Pictures problem |
| Time Machine | Skip for now (we'll set up properly with an external SSD later) |
| FileVault | **ON** — full disk encryption, mandatory for clinical data on dev machine |
| Touch ID | Enrol both index fingers |
| Locale | Australia, AUD, en_AU |
| Siri | Off (you don't need it on a dev machine) |
| Analytics | Off |

After first boot:

```bash
# Verify Apple Silicon
uname -m
# Expected: arm64

# Verify macOS version (should be 15+)
sw_vers
```

---

## 2. System Settings (the ones that matter for dev)

Open **System Settings** and change:

**General → Software Update** → enable automatic updates. Stay current; don't drift two majors behind.

**Privacy & Security → FileVault** → confirm it's enabled and your recovery key is saved (Apple ID or printed copy in a safe place).

**Privacy & Security → App Management** → grant access to Terminal, your IDE, and any tool that will install software.

**Keyboard** → Key Repeat = max (slider all the way right). Delay Until Repeat = short. Massive QoL improvement in the editor.

**Trackpad** → enable three-finger drag (Accessibility → Pointer Control → Trackpad Options).

**Desktop & Dock** → Hide automatically when not in use (more screen for code).

**Battery** → Show percentage in menu bar.

**Screenshot location** — change from Desktop to a dedicated folder so screenshots don't pile up:

```bash
mkdir -p ~/Pictures/Screenshots
defaults write com.apple.screencapture location ~/Pictures/Screenshots
killall SystemUIServer
```

**Finder → Settings → Advanced** — Show all filename extensions. Show warning before changing extensions = OFF (you're a developer, you know what you're doing).

**Show hidden files in Finder:**

```bash
defaults write com.apple.finder AppleShowAllFiles -bool true
killall Finder
```

---

## 3. Xcode Command Line Tools

Required for: git, Homebrew, native Node modules, anything that compiles.

```bash
xcode-select --install
```

A dialog appears — click Install. Takes ~10 minutes. Verify:

```bash
xcode-select -p
# Expected: /Library/Developer/CommandLineTools

git --version
# Expected: git version 2.x.x (Apple Git-xxx)
```

You do NOT need full Xcode unless building iOS apps.

---

## 4. Homebrew

The macOS package manager. One-line install:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions at the end (it will tell you exactly what to add to your shell profile — do it). Then:

```bash
# Verify
brew --version
# Expected: Homebrew 4.x.x

# Update package metadata (do this first, always)
brew update
```

### Brewfile — install everything in one shot

Create `~/Brewfile` with this content:

```ruby
# CLI tools
brew "git"
brew "gh"                  # GitHub CLI
brew "jq"                  # JSON processor
brew "ripgrep"             # Faster grep
brew "fd"                  # Faster find
brew "bat"                 # Better cat
brew "eza"                 # Better ls
brew "fzf"                 # Fuzzy finder
brew "starship"            # Shell prompt
brew "mise"                # Runtime version manager (Node, Python, etc.)
brew "uv"                  # Python package manager + version manager
brew "supabase/tap/supabase"  # Supabase CLI
brew "postgresql@16"       # Postgres client tools (psql)
brew "tldr"                # Quick command examples
brew "dust"                # Better du
brew "btop"                # Better top
brew "wget"                # File downloader
brew "openssh"             # Latest ssh
brew "gnupg"               # GPG for commit signing
brew "pinentry-mac"        # GPG passphrase prompt

# Cask apps (GUI)
cask "docker"              # Docker Desktop
cask "visual-studio-code"  # Or "cursor" if you prefer
cask "tableplus"           # DB GUI
cask "raycast"             # Spotlight replacement
cask "rectangle"           # Window snap
cask "1password"           # Password manager
cask "1password-cli"       # 1Password CLI for secret retrieval
cask "notion"              # Or whatever notes app
cask "google-chrome"       # For testing
cask "firefox"             # For testing
cask "claude"              # Claude desktop app
```

Then install everything:

```bash
brew bundle --file=~/Brewfile
```

Takes ~15 minutes. Get coffee.

### Verify

```bash
brew bundle check --file=~/Brewfile
# Expected: The Brewfile's dependencies are satisfied.
```

---

## 5. Shell setup (zsh + starship)

macOS uses zsh by default since Catalina. Add starship for a clean, fast prompt and history sync.

Edit `~/.zshrc` (create if it doesn't exist):

```bash
# Homebrew (Apple Silicon)
eval "$(/opt/homebrew/bin/brew shellenv)"

# starship prompt
eval "$(starship init zsh)"

# mise (runtime versions)
eval "$(mise activate zsh)"

# fzf key bindings
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# History
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt SHARE_HISTORY        # Share between sessions
setopt HIST_IGNORE_DUPS     # No consecutive duplicates
setopt HIST_REDUCE_BLANKS

# Aliases
alias ls='eza --icons'
alias ll='eza -lah --icons --git'
alias cat='bat --paper-wrapping'
alias grep='rg'
alias find='fd'
alias k='kubectl'
alias g='git'

# Janet Cares shortcuts
alias jc='cd ~/code/longevity-coach-wha'
alias dev='pnpm dev'
alias build='pnpm build'
alias t='pnpm test'

# psql shortcut to local Supabase
alias lpsql='psql postgresql://postgres:postgres@127.0.0.1:54322/postgres'

# Path
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
```

Reload:

```bash
source ~/.zshrc
```

Verify starship:

```bash
echo $PROMPT
# (Should show starship's setup, not the default)
```

---

## 6. Git + SSH/GPG identity

### Configure git

```bash
git config --global user.name "James Murray"
git config --global user.email "your-github-email@whatever"
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.editor "code --wait"      # or whatever editor
```

### Generate a new SSH key (don't reuse the Air's — fresh machine, fresh key)

```bash
ssh-keygen -t ed25519 -C "james@janet.care - macbook pro m5"
# Save to default location, set a strong passphrase
```

Add to ssh-agent + Apple Keychain:

```bash
eval "$(ssh-agent -s)"

# Add a config entry to use Keychain
cat >> ~/.ssh/config <<'EOF'
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
EOF

ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Add to GitHub:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
# Now paste at https://github.com/settings/ssh/new
```

Verify:

```bash
ssh -T git@github.com
# Expected: Hi <username>! You've successfully authenticated...
```

### GPG for commit signing (optional but recommended)

```bash
# Generate a new key
gpg --full-generate-key
# Choose: (1) RSA and RSA, 4096 bits, 0 (does not expire), name + email
```

Configure git to use it:

```bash
gpg --list-secret-keys --keyid-format=long
# Note the GPG key ID after "sec   rsa4096/"

git config --global user.signingkey YOUR_KEY_ID_HERE
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Tell GPG to use pinentry-mac
mkdir -p ~/.gnupg
echo "pinentry-program /opt/homebrew/bin/pinentry-mac" > ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent
```

Export the public key + add to GitHub:

```bash
gpg --armor --export YOUR_KEY_ID_HERE | pbcopy
# Paste at https://github.com/settings/gpg/new
```

---

## 7. Runtimes (Node, Python) via mise

`mise` (formerly `rtx`) replaces nvm + pyenv + asdf with one tool. Faster, simpler.

### Node + pnpm

```bash
mise use --global node@22
npm install -g pnpm@latest
```

Verify:

```bash
node --version
# Expected: v22.x.x
pnpm --version
```

### Python via uv

`uv` is the modern Python toolchain (10–100× faster than pip/pyenv/poetry):

```bash
uv python install 3.12
uv python pin 3.12
```

Verify:

```bash
uv python --version
# Expected: Python 3.12.x
```

---

## 8. Docker Desktop (with the disk lesson baked in)

Docker is installed via the Brewfile above. Launch it:

```bash
open -a Docker
```

Wait for the whale icon in the menu bar to settle (~30s first launch).

**CRITICAL — set the VM disk allocation IMMEDIATELY:**

1. Docker Desktop → **Settings** (gear icon, top right)
2. **Resources** → **Disk image size**
3. **Drag slider to 30 GB** (default is 64 — way more than needed for Supabase local dev)
4. **Memory: 8 GB** (default is fine on a 24 GB machine)
5. **CPUs: 4** (don't give Docker all of them)
6. Apply & Restart

Verify:

```bash
docker --version
docker ps
# Both should print without error
```

---

## 9. Supabase CLI

Installed via Brewfile. Authenticate:

```bash
supabase login
# Opens browser; sign in with your Supabase account
```

Verify:

```bash
supabase projects list
# Should list your projects including longevity-coach-wha
```

---

## 10. GitHub CLI

```bash
gh auth login
# Choose: github.com, HTTPS, login with web browser
```

Verify:

```bash
gh auth status
gh repo view Work-Healthy-Australia/longevity-coach-wha
```

---

## 11. VS Code (or Cursor) extensions

Install extensions in one command. Save this as `~/code-extensions.sh`:

```bash
#!/bin/bash
# Run this AFTER installing VS Code

extensions=(
  "anthropic.claude-code"            # Claude Code integration
  "supabase.supabase-vscode"         # Supabase
  "esbenp.prettier-vscode"
  "dbaeumer.vscode-eslint"
  "bradlc.vscode-tailwindcss"
  "vitest.explorer"
  "ms-azuretools.vscode-docker"
  "GitHub.vscode-pull-request-github"
  "usernamehw.errorlens"             # Inline error display
  "wayou.vscode-todo-highlight"
  "naumovs.color-highlight"
  "yoavbls.pretty-ts-errors"         # Readable TS error messages
  "mikestead.dotenv"                 # .env syntax
  "redhat.vscode-yaml"
)

for ext in "${extensions[@]}"; do
  code --install-extension "$ext"
done
```

Then:

```bash
chmod +x ~/code-extensions.sh
~/code-extensions.sh
```

VS Code settings worth changing (Cmd+,):
- Editor: Format on Save = ON
- Editor: Default Formatter = Prettier
- Files: Auto Save = onFocusChange
- TypeScript: Inlay Hints: Parameter Names = literals

---

## 12. Claude Code CLI

```bash
# Install via the official installer
curl -fsSL https://claude.com/install.sh | bash

# Or via npm
npm install -g @anthropic-ai/claude-code
```

Authenticate:

```bash
claude
# First run prompts for login
```

---

## 13. Clone the project

```bash
mkdir -p ~/code
cd ~/code
git clone git@github.com:Work-Healthy-Australia/longevity-coach-wha.git
cd longevity-coach-wha
```

### Environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in the secret values. Get them from:

| Secret | Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same place |
| `SUPABASE_SECRET_KEY` | Same place — service role key |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks → your endpoint → Signing secret |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → Settings → API Keys |

**Strongly recommended:** put all of these in **1Password** as a single Janet Cares dev secrets item, then use `op` CLI to inject them. Means you never have a `.env.local` lying around in plain text:

```bash
# Once secrets are in 1Password:
op inject -i .env.example -o .env.local
```

---

## 14. First boot of the project

```bash
# From ~/code/longevity-coach-wha
pnpm install              # ~2 min first time
pnpm build                # Verify it compiles cleanly
pnpm test                 # Verify tests pass
```

Then start Supabase locally:

```bash
supabase start
# First run pulls ~2 GB of Docker images. ~5 min.
```

When it finishes you'll see:

```
API URL:        http://127.0.0.1:54321
DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:     http://127.0.0.1:54323
Inbucket URL:   http://127.0.0.1:54324
JWT secret:     ...
anon key:       ...
service_role key: ...
```

Add the local URLs + keys to `.env.local` if you want the dev server to talk to local Supabase instead of cloud.

Start the Next.js dev server:

```bash
pnpm dev
# Opens at http://localhost:3000
```

---

## 15. Time Machine setup (avoid repeating today's snapshot disaster)

Buy a USB-C external SSD (1 TB minimum, ideally 2 TB — Samsung T7 or T9 is the standard pick). Plug in, then:

1. **System Settings → General → Time Machine**
2. **Add Backup Disk** → select the external SSD
3. **Encrypt backups** = YES (mandatory for clinical-data dev machine)
4. Set a strong password (save in 1Password)

Why this matters: Time Machine creates local snapshots constantly. With a destination drive plugged in, snapshots rotate to that drive and the local copies get freed. Without one (your Air's situation), local snapshots accumulate and pin disk space — exactly the problem you hit today.

Plug the drive in **at least once a day** during normal work. Or leave it permanently plugged into a desk hub.

---

## 16. Backup hygiene rules

To keep this machine healthy long-term:

| Rule | Frequency | Command/Action |
|---|---|---|
| Empty `~/Downloads` of anything older than 30 days | Weekly | `find ~/Downloads -mtime +30 -delete` (with care) |
| `brew cleanup` | Monthly | `brew cleanup -s` |
| `pnpm store prune` | Monthly | Frees pnpm cache |
| `docker system prune -a` | Monthly | Wipes unused Docker images/containers |
| Verify Time Machine is backing up | Weekly | `tmutil latestbackup` |
| Check disk free space | Anytime it feels slow | `df -h /System/Volumes/Data` |
| Keep `/System/Volumes/Data` above 50 GB free | Always | If under, run the cleanups above |

---

## 17. Final sanity check

After everything above:

```bash
# Disk space (should be 700+ GB free on a fresh 1 TB)
df -h /System/Volumes/Data

# Versions of the things that matter
node --version
pnpm --version
git --version
docker --version
supabase --version
gh --version

# Project boots
cd ~/code/longevity-coach-wha
pnpm dev    # Should start on :3000
supabase start  # Should boot the local stack

# psql connects
lpsql -c "select count(*) from public.profiles;"
```

If all of those return clean output, you're done. Total time from boot to ready: ~90 minutes including Docker image pulls.

---

## Things you do NOT need on a dev machine

Don't install just because they were on the Air:
- Microsoft Office (use Google Docs / Notes / Pages)
- Adobe Creative Cloud (heavy; install only if needed)
- Steam, games (not for a work machine)
- Skype (Zoom + Teams classic cover everything)
- Any Air-era one-off tools you haven't opened in 6 months

Discipline now = healthy machine in 12 months.
