The command `sudo service postgresql status` is for Linux-based systems, not for Windows. On Windows, you need to manage PostgreSQL using different tools. Here's how you can do it on Windows:

### Checking PostgreSQL Service on Windows

1. **Using Services Manager**:
   - Press `Win + R`, type `services.msc`, and press `Enter`.
   - In the Services window, look for `PostgreSQL` in the list of services.
   - Ensure that the status is `Running`. If it is not, you can start it by right-clicking on it and selecting `Start`.

2. **Using Command Line**:
   - Open Command Prompt as an administrator.
   - Run the following command to check the status of PostgreSQL:
     ```sh
     net start | findstr /i "postgresql"
     ```
   - If PostgreSQL is running, you should see it listed in the output. If not, start it with:
     ```sh
     net start postgresql-x64-13
     ```
     Note: The version number (`x64-13`) might be different based on the version of PostgreSQL you have installed. Replace it accordingly.

### Verifying Database and User in PostgreSQL

1. **Using pgAdmin**:
   - Open `pgAdmin` and connect to your PostgreSQL server.
   - Verify that the `WhitefeatherDB` database exists and that the user `Amberyl` has access to it.

2. **Using psql**:
   - Open Command Prompt.
   - Navigate to the PostgreSQL bin directory:
     ```sh
     cd "C:\Program Files\PostgreSQL\<version>\bin"
     ```
     Replace `<version>` with your PostgreSQL version.
   - Run `psql` to access the PostgreSQL shell:
     ```sh
     psql -U postgres
     ```
   - List the databases and users:
     ```sql
     \l
     \du
     ```
   - Verify that `WhitefeatherDB` and `Amberyl` exist.

### Testing Connection with Java Class

Since your `DatabaseConnector` Java class can connect to the database, it confirms that the database is accessible. Ensure that the Spring Boot application is using the same database credentials.

### Ensure Data in the Database

1. **Check Data**:
   - In `pgAdmin`, connect to your database and run a simple query to ensure there is data in the `PlayChar` table:
     ```sql
     SELECT * FROM "PlayChar";
     ```

### Re-check Spring Boot Configuration

1. **Ensure Correct Credentials in `application.yaml`**:
   Make sure the credentials in `application.yaml` match those you use in your `DatabaseConnector`:
   ```yaml
   spring:
     datasource:
       url: jdbc:postgresql://localhost:5432/WhitefeatherDB
       username: Amberyl
       password: Khelekmir%5
       driver-class-name: org.postgresql.Driver
   ```

2. **Verify Repository**:
   Ensure your `PlayCharRepository` is defined correctly:
   ```java
   @Repository
   public interface PlayCharRepository extends JpaRepository<PlayChar, String> {
       Optional<PlayChar> findByName(String name);
   }
   ```

### Testing the Endpoint

Use Postman or Curl to test your endpoint. 

- **Using Curl**:
  ```sh
  curl -X GET http://localhost:5000/api/characters
  ```

- **Using Postman**:
  - Open Postman and create a new GET request.
  - Set the URL to `http://localhost:5000/api/characters`.
  - Send the request and observe the response.

### Check Logs

- Run your Spring Boot application and check the console logs for any errors related to database connectivity or missing tables.

By following these steps, you should be able to ensure that your PostgreSQL is correctly configured and that your Spring Boot application can connect to it and retrieve data. If you encounter any specific error messages, please share them for further assistance.