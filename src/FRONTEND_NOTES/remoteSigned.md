You need to change the PowerShell execution policy to allow running scripts, including `npm` commands. Since you're using Windows and want to freely run npm scripts for personal projects, I recommend setting the execution policy to **"RemoteSigned"**, which allows local scripts to run while requiring downloaded scripts to be signed.

### Steps to Change the Execution Policy:

1. **Open PowerShell as Administrator**:
   - Click **Start**, type **PowerShell**.
   - Right-click **Windows PowerShell** and select **Run as administrator**.

2. **Check the Current Execution Policy** *(Optional, but good for reference)*:
   ```powershell
   Get-ExecutionPolicy -List
   ```
   This will show the policies for different scopes.

3. **Set Execution Policy to RemoteSigned**:
   Run the following command:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
   - This change applies only to your user account.
   - If prompted, type **Y** and press **Enter** to confirm.

4. **Verify the Change**:
   Run:
   ```powershell
   Get-ExecutionPolicy
   ```
   It should return **RemoteSigned**.

5. **Restart PowerShell & Try Running npm Again**:
   Close PowerShell and reopen **Visual Studio Code** or a new PowerShell window, then try:
   ```powershell
   npm start
   ```

If you still run into issues, let me know! 🚀