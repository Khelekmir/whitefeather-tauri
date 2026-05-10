Let's first ensure that your PostgreSQL setup and your Spring Boot configuration are correct.

### PostgreSQL Configuration
1. **Check PostgreSQL Service**:
   Ensure that PostgreSQL is running. You can check this using:
   ```sh
   sudo service postgresql status
   ```
   If it's not running, start it with:
   ```sh
   sudo service postgresql start
   ```

2. **Verify Database and User**:
   - Log in to the PostgreSQL shell:
     ```sh
     sudo -u postgres psql
     ```
   - List the databases:
     ```sql
     \l
     ```
   - List the users:
     ```sql
     \du
     ```
   - Ensure that the database `WhitefeatherDB` and the user `Amberyl` exist. If not, create them:
     ```sql
     CREATE DATABASE "WhitefeatherDB";
     CREATE USER "Amberyl" WITH PASSWORD 'Khelekmir%5';
     GRANT ALL PRIVILEGES ON DATABASE "WhitefeatherDB" TO "Amberyl";
     ```

3. **Check Database Access**:
   Ensure that the user `Amberyl` has the necessary privileges on the database `WhitefeatherDB`.

### Spring Boot Configuration
Your `application.yaml` configuration looks correct. Here it is for reference:

```yaml
spring:
  application:
    name: whitefeather-backend
  datasource:
    url: jdbc:postgresql://localhost:5432/WhitefeatherDB
    username: Amberyl
    password: Khelekmir%5
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    show-sql: true
server:
  address: 0.0.0.0
  port: 5000
```

### Troubleshooting Steps

1. **Test Database Connection**:
   Since your `DatabaseConnector` class can connect to the database, let's ensure that your Spring Boot application can do the same. 

2. **Check for Errors in Logs**:
   Start your Spring Boot application and check the logs for any errors related to database connections.

3. **Validate Repository and Service Configuration**:
   Ensure your repository and service classes are correctly set up to interact with the database.

### Sample Test Repository and Service

1. **Repository**:
   ```java
   @Repository
   public interface PlayCharRepository extends JpaRepository<PlayChar, String> {
       Optional<PlayChar> findByName(String name);
   }
   ```

2. **Service**:
   ```java
   @Service
   @Transactional
   public class PlayCharService {

       private final PlayCharRepository playCharRepository;

       public PlayCharService(PlayCharRepository playCharRepository) {
           this.playCharRepository = playCharRepository;
       }

       public void create(PlayChar newPlayChar) {
           playCharRepository.save(newPlayChar);
       }

       public Optional<PlayChar> getPlayCharByName(String name) throws ResourceNotFoundException {
           return playCharRepository.findByName(name);
       }

       public List<PlayChar> getPlayChars() {
           return playCharRepository.findAll();
       }

       public Optional<PlayChar> deletePlayChar(String name) {
           try {
               Optional<PlayChar> deletedPlayChar = playCharRepository.findByName(name);
               playCharRepository.deleteById(name);
               return deletedPlayChar;
           } catch (EmptyResultDataAccessException e) {
               return Optional.empty();
           }
       }
   }
   ```

### Test the Endpoint
1. **Verify the Endpoint**:
   Use a tool like `Postman` or `curl` to make a GET request to `http://localhost:5000/api/characters`.

   ```sh
   curl -X GET http://localhost:5000/api/characters
   ```

2. **Check the Response**:
   - If the response is valid JSON but empty, it means the endpoint is correctly set up but the database might not have any entries.
   - If you receive an error, it indicates an issue in the backend logic or configuration.

### Debugging with Postman
- Open Postman and create a new GET request.
- Set the URL to `http://localhost:5000/api/characters`.
- Send the request and observe the response.

### Debugging Tips
- **Check Console Logs**: Look for any stack traces or error messages in your Spring Boot application logs.
- **Enable SQL Logging**: Your configuration already includes `show-sql: true`, which should print SQL statements executed by Hibernate. This can help you see if the queries are being run.
- **Check Database**: Verify that the tables and data are present in your PostgreSQL database as expected.

If you follow these steps and still face issues, please share any error messages or logs you encounter. This will help in providing more precise troubleshooting.