To delete a branch you're done with, you can use the following Git command:

### Deleting a Local Branch
```bash
git branch -d branch_name
```
- This deletes the branch named `branch_name` **if it has been fully merged** into your current branch or another branch.
- If the branch is not fully merged and you still want to delete it, you can force it with:
  ```bash
  git branch -D branch_name
  ```

### Deleting a Remote Branch
If you want to delete a branch from the remote repository:
```bash
git push origin --delete branch_name
```

### Example Workflow
1. **Switch to another branch** (you cannot delete the branch you're currently on):
   ```bash
   git checkout main
   ```
2. **Delete the local branch**:
   ```bash
   git branch -d feature-branch
   ```
3. **Delete the remote branch** (if necessary):
   ```bash
   git push origin --delete feature-branch
   ```

This ensures the branch is cleaned up locally and remotely once you're done with it!