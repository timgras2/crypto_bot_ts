# Git & GitHub Commit Strategy

This document outlines the Git workflow and commit strategy for the crypto_bot_ts project.

## Repository Structure

**GitHub Repository**: https://github.com/timgras2/crypto_bot_ts

**Primary Branch**: `main`
- Production-ready code only
- All commits must be tested and working
- Protected branch (recommended settings below)

## Branch Strategy

### Branch Types

1. **main** - Production-ready code
   - Always deployable
   - Protected branch (requires PR for changes)
   - Tagged for releases

2. **feature/** - New features
   - Format: `feature/short-description`
   - Examples: `feature/binance-support`, `feature/telegram-alerts`
   - Branched from: `main`
   - Merged into: `main` via PR

3. **fix/** - Bug fixes
   - Format: `fix/short-description`
   - Examples: `fix/stop-loss-calculation`, `fix/rate-limit-error`
   - Branched from: `main`
   - Merged into: `main` via PR

4. **refactor/** - Code refactoring
   - Format: `refactor/short-description`
   - Examples: `refactor/api-client`, `refactor/trade-manager`
   - Branched from: `main`
   - Merged into: `main` via PR

5. **docs/** - Documentation updates
   - Format: `docs/short-description`
   - Examples: `docs/api-guide`, `docs/setup-instructions`
   - Branched from: `main`
   - Merged into: `main` via PR

6. **test/** - Test improvements
   - Format: `test/short-description`
   - Examples: `test/trade-manager`, `test/e2e-scenarios`
   - Branched from: `main`
   - Merged into: `main` via PR

### Branch Workflow

```bash
# Create and switch to a new feature branch
git checkout -b feature/add-binance-support

# Work on your changes, commit frequently
git add .
git commit -m "feat(api): add Binance API client"

# Push to GitHub
git push -u origin feature/add-binance-support

# Create PR on GitHub
gh pr create --title "Add Binance Exchange Support" --body "..."

# After PR approval, merge and delete branch
gh pr merge --squash --delete-branch
```

## Commit Message Convention

We follow **Conventional Commits** specification for clear, semantic commit history.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **chore**: Maintenance tasks (dependencies, build scripts)
- **ci**: CI/CD configuration changes
- **build**: Build system or dependency changes

### Scopes

Common scopes for this project:

- **api**: Exchange API client (MEXC, future exchanges)
- **market**: Market tracking and new listing detection
- **trade**: Trade execution and monitoring
- **config**: Configuration management
- **logger**: Logging utilities
- **types**: TypeScript type definitions
- **tests**: Test files and infrastructure
- **docs**: Documentation files

### Examples

```bash
# Feature addition
git commit -m "feat(api): add Binance API client with rate limiting"

# Bug fix
git commit -m "fix(trade): correct trailing stop percentage calculation"

# Breaking change (note the !)
git commit -m "feat(config)!: change MAX_TRADE_AMOUNT to required parameter"

# With body
git commit -m "refactor(market): optimize market comparison algorithm

Replace O(n²) nested loops with Set-based diffing for O(n) performance.
Reduces CPU usage on exchanges with 1000+ trading pairs."

# Multiple changes
git commit -m "chore: update dependencies and improve build config

- Update typescript to 5.3.3
- Add stricter ESLint rules
- Configure jest for better coverage"
```

### Commit Best Practices

1. **Write in imperative mood**: "add feature" not "added feature"
2. **Keep subject line under 72 characters**
3. **Capitalize first letter of subject**
4. **No period at end of subject line**
5. **Separate subject from body with blank line**
6. **Use body to explain what and why, not how**
7. **Reference issues/PRs in footer**: `Closes #123`, `Fixes #456`
8. **Commit early and often**: Small, focused commits are better than large ones
9. **Test before committing**: Run `npm test` and `npm run lint`

## Pull Request Workflow

### Creating a PR

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat(scope): add feature"
   ```

3. **Push to GitHub**
   ```bash
   git push -u origin feature/my-feature
   ```

4. **Create PR via GitHub CLI or web interface**
   ```bash
   gh pr create --title "Add My Feature" --body "## Summary

   Description of changes

   ## Testing
   - [ ] Unit tests pass
   - [ ] Linting passes
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Updated documentation
   - [ ] Added/updated tests
   - [ ] No breaking changes (or documented if present)"
   ```

### PR Title Format

Follow conventional commit format:
```
feat(scope): add new feature
fix(trade): resolve stop-loss bug
docs(readme): improve setup instructions
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Manual testing completed
- [ ] Tested with real MEXC API (testnet if applicable)

## Breaking Changes
List any breaking changes or "None"

## Related Issues
Closes #123
Related to #456
```

### PR Review Checklist

Before requesting review:
- [ ] All tests pass
- [ ] Linting passes
- [ ] TypeScript compiles without errors
- [ ] Code follows project conventions
- [ ] Documentation updated
- [ ] No sensitive data (API keys, secrets) in commits
- [ ] `.env` file not committed (verify `.gitignore`)
- [ ] Commit messages follow convention
- [ ] No `console.log` statements (use logger instead)

### Merging Strategy

**Squash and Merge** (recommended for most PRs):
- Keeps main branch history clean
- Combines all commits into one
- Use for feature branches with many small commits

```bash
gh pr merge --squash --delete-branch
```

**Regular Merge** (for important multi-commit features):
- Preserves individual commits
- Use when commit history is meaningful

```bash
gh pr merge --merge --delete-branch
```

**Rebase and Merge** (for clean linear history):
- Replays commits on top of main
- Use for simple changes with clean commit history

```bash
gh pr merge --rebase --delete-branch
```

## Protected Branch Settings (Recommended)

Configure `main` branch protection on GitHub:

1. **Require pull request reviews before merging**
   - Required approving reviews: 1 (adjust based on team size)
   - Dismiss stale reviews when new commits are pushed

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Status checks: CI/CD pipeline (tests, linting, build)

3. **Require conversation resolution before merging**

4. **Do not allow bypassing the above settings**

5. **Restrict who can push to matching branches** (optional)

## Versioning Strategy

Follow **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features, backwards compatible (e.g., 1.0.0 → 1.1.0)
- **PATCH**: Bug fixes, backwards compatible (e.g., 1.0.0 → 1.0.1)

### Tagging Releases

```bash
# After merging to main, create a tag
git checkout main
git pull origin main

# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0: Add Binance support"

# Push tag to GitHub
git push origin v1.2.0

# Create GitHub release
gh release create v1.2.0 --title "v1.2.0" --notes "Release notes here"
```

### Version Bump Guidelines

- **Patch (0.0.X)**: Bug fixes, minor documentation updates
- **Minor (0.X.0)**: New features, new exchange support, enhancements
- **Major (X.0.0)**: Breaking API changes, architecture overhauls, config format changes

## Initial Repository Setup

Since this is a new repository, here's the setup process:

```bash
# 1. Initialize repository (already done)
git init
git remote add origin https://github.com/timgras2/crypto_bot_ts.git

# 2. Create initial commit
git add .
git commit -m "chore: initial commit with MEXC trading bot

- TypeScript trading bot for MEXC exchange
- Automated new listing detection
- Trailing stop-loss protection
- Comprehensive test suite
- Full documentation"

# 3. Create main branch and push
git branch -M main
git push -u origin main

# 4. Verify .gitignore excludes sensitive files
# Ensure .env, data/, logs/ are not tracked
git status  # Should not show .env, data/, or logs/
```

## Safety Checklist Before Pushing

⚠️ **Critical checks before every push**:

- [ ] `.env` file is **NOT** committed (contains API keys)
- [ ] `data/` directory is **NOT** committed (contains trade state)
- [ ] `logs/` directory is **NOT** committed (contains logs)
- [ ] `node_modules/` is **NOT** committed
- [ ] No hardcoded API keys or secrets in code
- [ ] No real trading data or account info in commits
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] TypeScript compiles: `npm run build`

### Verify .gitignore

```bash
# Check what would be committed
git status

# Verify .gitignore is working
git check-ignore .env data/ logs/ node_modules/

# Should output the paths if properly ignored
```

### Remove Accidentally Committed Secrets

If you accidentally commit sensitive data:

```bash
# Remove file from last commit (before pushing)
git rm --cached .env
git commit --amend -m "chore: remove .env from tracking"

# If already pushed, you MUST rotate API keys immediately
# Then remove from history using git-filter-repo or BFG Repo-Cleaner
```

## Common Git Commands

### Daily Workflow

```bash
# Update local main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Stage changes
git add <file>          # Stage specific file
git add .               # Stage all changes
git add -p              # Interactive staging

# Commit
git commit -m "feat(scope): description"

# Push to remote
git push -u origin feature/my-feature

# Update branch with latest main
git checkout main
git pull origin main
git checkout feature/my-feature
git rebase main         # or: git merge main
```

### Useful Commands

```bash
# View commit history
git log --oneline --graph --decorate --all

# View changes
git diff                # Unstaged changes
git diff --staged       # Staged changes
git diff main           # Compare to main branch

# Undo changes
git restore <file>      # Discard unstaged changes
git restore --staged <file>  # Unstage file
git reset HEAD~1        # Undo last commit (keep changes)
git reset --hard HEAD~1 # Undo last commit (discard changes)

# Stash work in progress
git stash               # Save changes temporarily
git stash pop           # Restore stashed changes
git stash list          # List all stashes

# Clean up branches
git branch -d feature/my-feature    # Delete local branch
git push origin --delete feature/my-feature  # Delete remote branch
```

## Collaboration Guidelines

1. **Communicate**: Use PR comments for discussions
2. **Review thoughtfully**: Provide constructive feedback
3. **Test others' PRs**: Check out branches locally if needed
4. **Keep PRs focused**: One feature/fix per PR
5. **Update documentation**: Keep docs in sync with code changes
6. **Respect the main branch**: Never force push to main
7. **Tag others**: Use `@username` to request reviews

## Emergency Procedures

### Reverting a Bad Commit

```bash
# Create revert commit (safe)
git revert <commit-hash>
git push origin main

# Force push (dangerous, avoid on main)
# Only if absolutely necessary and after team coordination
git reset --hard <good-commit-hash>
git push --force origin main
```

### Rolling Back a Release

```bash
# Create hotfix branch from previous tag
git checkout v1.1.0
git checkout -b hotfix/rollback-v1.2.0

# Make necessary fixes
git commit -m "fix: rollback breaking changes from v1.2.0"

# Create new patch release
git tag -a v1.1.1 -m "Hotfix: rollback v1.2.0"
git push origin v1.1.1
```

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Git Best Practices](https://git-scm.com/book/en/v2)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
