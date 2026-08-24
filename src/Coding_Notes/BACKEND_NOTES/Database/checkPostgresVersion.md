You're right — **pgAdmin 4** is the admin interface, but it connects to a specific **PostgreSQL server** version.

To check your **PostgreSQL version**, you can do any of the following:

---

### ✅ Option 1: Run SQL in pgAdmin Query Tool

1. Open **pgAdmin 4**.
2. Select your database.
3. Open the **Query Tool**.
4. Run:

```sql
SELECT version();
```

This will return something like:

```
PostgreSQL 15.3 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 12.2.0, 64-bit
```

---

### ✅ Option 2: Use the Dashboard

1. In pgAdmin 4, click on your **server name** (on the left).
2. Look at the **Dashboard** tab.
3. The **"Server"** section shows the PostgreSQL version at the top (e.g., `PostgreSQL 14`).

---

### ✅ Option 3: CLI (if you use `psql`)

If you're using the command line and connected via `psql`, you can type:

```bash
psql -U your_user -d your_db
```

Then, inside the prompt:

```sql
SELECT version();
```

---

Let me know what version you see — I can help tailor your `jsonb` logic based on it.
