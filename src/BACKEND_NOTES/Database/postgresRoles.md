The error message "role 'isles' does not exist" suggests that the PostgreSQL database is trying to authenticate a role (i.e., a database user) named "isles," which doesn't exist in the database.

To fix this, follow these steps:

### 1. Create the Role in PostgreSQL

Since you're using pgAdmin, you can create the `isles` role directly from there:

1. **Open pgAdmin** and connect to your PostgreSQL instance.
2. In the **Object Browser** on the left side, expand the **Servers** node, then expand your server, and then the **Login/Group Roles** node.
3. **Right-click** on **Login/Group Roles** and select **Create** → **Login/Group Role**.
4. In the dialog box:
   - **Role Name**: Enter `isles`.
   - Under the **Definition** tab, you can set a password if needed.
   - Under the **Privileges** tab, you can assign specific privileges like `SUPERUSER` or `CREATEDB` based on your needs.
5. **Click Save** to create the role.

### 2. Grant Permissions

Make sure that the `isles` role has appropriate permissions for the database you are trying to interact with.

1. In pgAdmin, under the **Databases** section, right-click the relevant database and choose **Properties**.
2. Under the **Privileges** tab, ensure that the `isles` role has sufficient privileges like `CONNECT`, `SELECT`, `INSERT`, etc.

### 3. Verify the Database Connection

If you’re using a connection string in your `DatabaseConnector.createConnection()` method, ensure that the username in the connection URL or configuration is `isles`.

For example:

```java
Connection conn = DriverManager.getConnection("jdbc:postgresql://localhost:5432/yourdbname", "isles", "yourpassword");
```

### 4. Test Your Code Again

After creating the role and assigning the necessary privileges, run your code again to see if the error is resolved.

Let me know if you run into any issues!