To re-create a remote branch after deleting it, you can follow these steps:

### 1. **Create the Local Branch**
If you don't already have a local branch named `working`:
```bash
git checkout -b working
```
This creates and switches to the `working` branch locally.

### 2. **Push the Local Branch to the Remote**
Push the branch to the remote repository to re-create it there:
```bash
git push -u origin working
```
- The `-u` flag sets the remote branch as the upstream branch for the local one. This allows you to use `git pull` or `git push` without specifying the branch name in the future.

### Example Workflow
1. After deleting the `working` branch:
   ```bash
   git branch -d working           # Delete locally
   git push origin --delete working  # Delete remotely
   ```

2. Later, re-create the branch:
   ```bash
   git checkout -b working         # Create locally
   git push -u origin working      # Push to the remote
   ```

Now, the `working` branch exists both locally and on the remote, and you're ready to continue working on it!