Rolling back to the last push in Git involves resetting your local repository to the state of the last commit that you pushed. This can be done using the `git reset` command. Here are the steps:

### Step-by-Step Guide to Roll Back to the Last Push

1. **Check the Status of Your Repository:**
   Before you reset your repository, it's a good idea to check its status to understand what changes you have.

   ```bash
   git status
   ```

2. **Identify the Last Pushed Commit:**
   You can use `git log` to find the last commit you pushed. Typically, you want to reset to the HEAD of the current branch.

   ```bash
   git log --oneline
   ```

   Look for the commit hash (a string of characters like `abc1234`) of the last pushed commit.

3. **Reset to the Last Pushed Commit:**
   Use the `git reset` command to reset your branch to the last pushed commit. The `--hard` option will discard all changes in the working directory and the index.

   ```bash
   git reset --hard origin/<your-branch-name>
   ```

   Replace `<your-branch-name>` with the name of your branch (e.g., `main`, `master`, `develop`).

### Example

Assuming your branch name is `main`:

```bash
git reset --hard origin/main
```

### Explanation of the Command

- `git reset`: This command is used to reset your current HEAD to a specified state.
- `--hard`: This option discards all changes in the working directory and the index. This means any changes you have made locally that are not committed will be lost.
- `origin/main`: This refers to the state of the `main` branch on the remote repository named `origin`. This effectively resets your local branch to match the remote branch.

### Note on Uncommitted Changes

Using `--hard` will discard all local changes that have not been committed. If you have uncommitted changes that you want to keep, you should stash them before running the reset command:

1. **Stash Your Changes:**
   ```bash
   git stash
   ```

2. **Reset to the Last Pushed Commit:**
   ```bash
   git reset --hard origin/main
   ```

3. **Apply Your Stashed Changes (if needed):**
   ```bash
   git stash apply
   ```

### Summary

Resetting your branch to the last push is straightforward with `git reset --hard origin/<branch-name>`. Just be careful with the `--hard` option as it will discard all local changes. If you want to keep your local changes, consider stashing them before performing the reset.