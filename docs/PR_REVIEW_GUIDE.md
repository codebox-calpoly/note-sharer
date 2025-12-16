# Pull Request Review Guide

This guide explains how to review, comment on, and merge pull requests using the GitHub CLI (`gh`) without needing Cursor or the GitHub web interface.

## Prerequisites

1. **Install GitHub CLI** (if not already installed):
   ```bash
   brew install gh  # macOS
   # or
   npm install -g gh  # via npm
   ```

2. **Authenticate with GitHub**:
   ```bash
   gh auth login
   ```
   This will open a browser for authentication. Follow the prompts.

## Viewing Pull Requests

### List all open PRs
```bash
gh pr list
```

### View details of a specific PR
```bash
gh pr view <PR_NUMBER>
# Example: gh pr view 6
```

### View PR diff (what changed)
```bash
gh pr diff <PR_NUMBER>
# Example: gh pr diff 6
```

### View PR in browser
```bash
gh pr view <PR_NUMBER> --web
```

## Writing Comments on Pull Requests

### Add a general comment to a PR
```bash
gh pr comment <PR_NUMBER> --body "Your comment here"
# Example: gh pr comment 6 --body "Looks good! Just need to fix the merge conflict."
```

### Comment on a specific file/line (inline comment)
```bash
gh pr comment <PR_NUMBER> --body "Comment text" --repo <OWNER/REPO> --file <FILE_PATH> --line <LINE_NUMBER>
# Example: gh pr comment 6 --body "This needs updating" --file README.md --line 14
```

### Edit an existing comment
You'll need to use the GitHub API or web interface for editing comments. The CLI doesn't support editing directly.

### Examples of useful comments:
```bash
# Approve with comment
gh pr comment 6 --body "✅ Approved! Great work on the README update."

# Request changes
gh pr comment 6 --body "❌ Please fix the merge conflict before merging. Run: git checkout main && git pull && git checkout <branch> && git merge main"

# Ask questions
gh pr comment 6 --body "❓ Can you add your LinkedIn profile URL to the link?"

# General feedback
gh pr comment 6 --body "💡 Consider adding more details in the description section."
```

## Reviewing Pull Requests

### Approve a PR
```bash
gh pr review <PR_NUMBER> --approve
# Example: gh pr review 6 --approve
```

### Request changes
```bash
gh pr review <PR_NUMBER> --request-changes --body "Please fix the following issues: ..."
# Example: gh pr review 6 --request-changes --body "Fix merge conflicts and update LinkedIn link"
```

### Add a comment review (without approval/rejection)
```bash
gh pr review <PR_NUMBER> --comment --body "Your review comment"
# Example: gh pr review 6 --comment --body "This looks good, but could use more detail"
```

## Merging Pull Requests

### Step 1: Check for merge conflicts
```bash
gh pr checkout <PR_NUMBER>
git fetch origin main
git merge origin/main
```

If there are conflicts:
1. Resolve them manually in your editor
2. Stage the resolved files: `git add <file>`
3. Commit: `git commit -m "Resolve merge conflicts"`
4. Push: `git push`

### Step 2: Merge the PR

**Option A: Merge via CLI (if no conflicts)**
```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
# Example: gh pr merge 6 --merge --delete-branch
```

**Option B: Merge manually (if CLI merge fails)**
```bash
git checkout main
git pull
git merge <BRANCH_NAME> --no-ff -m "Merge PR #<NUMBER>: <TITLE>"
git push
gh pr close <PR_NUMBER> --comment "Merged manually"
```

**Option C: Use admin privileges (if branch protection blocks merge)**
```bash
gh pr merge <PR_NUMBER> --merge --delete-branch --admin
```

### Merge strategies:
- `--merge`: Creates a merge commit (default)
- `--squash`: Squashes all commits into one
- `--rebase`: Rebases commits onto main (linear history)

## Complete Workflow Example

Here's a complete example of reviewing and merging a PR:

```bash
# 1. List all PRs
gh pr list

# 2. View PR details
gh pr view 6

# 3. Checkout and test the PR locally
gh pr checkout 6

# 4. Check for conflicts
git fetch origin main
git merge origin/main

# 5. If conflicts exist, resolve them:
#    - Edit files to fix conflicts
#    - git add <files>
#    - git commit -m "Resolve conflicts"
#    - git push

# 6. Add a comment
gh pr comment 6 --body "✅ Conflicts resolved, ready to merge!"

# 7. Approve the PR
gh pr review 6 --approve

# 8. Merge the PR
gh pr merge 6 --merge --delete-branch --admin

# 9. Clean up (switch back to main)
git checkout main
git pull
```

## Batch Reviewing Multiple PRs

To review multiple PRs efficiently:

```bash
# 1. List all PRs
gh pr list

# 2. For each PR, run:
for pr in 6 7 8; do
  echo "Reviewing PR #$pr"
  gh pr view $pr
  gh pr diff $pr
  # Review the diff, then:
  # gh pr review $pr --approve
  # gh pr merge $pr --merge --delete-branch --admin
done
```

## Troubleshooting

### "PR is not mergeable"
- Check for conflicts: `gh pr checkout <NUMBER>` then `git merge origin/main`
- Resolve conflicts and push
- Try merging again

### "Base branch policy prohibits merge"
- Use `--admin` flag: `gh pr merge <NUMBER> --merge --admin`
- Or merge manually and close the PR

### "Authentication required"
- Run: `gh auth login`
- Follow the browser prompts

## Useful Aliases (Optional)

Add these to your `~/.zshrc` or `~/.bashrc` for shortcuts:

```bash
alias pr-list='gh pr list'
alias pr-view='gh pr view'
alias pr-merge='gh pr merge --merge --delete-branch --admin'
alias pr-approve='gh pr review --approve'
alias pr-comment='gh pr comment'
```

Then use: `pr-list`, `pr-view 6`, `pr-merge 6`, etc.

## Additional Resources

- GitHub CLI docs: https://cli.github.com/manual/
- PR review best practices: https://github.com/codebox-calpoly/NoteSharer/docs/contributing.md



