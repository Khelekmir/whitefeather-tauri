

The issue here is that the `getConnection` method of the `DriverManager` class is being called with two arguments: a `String` URL and another `String` password. However, the `getConnection` method does not have a version that takes two `String` arguments.

According to the Java API documentation, the `getConnection` method has three overloads:

1. `getConnection(String url)`
2. `getConnection(String url, Properties info)`
3. `getConnection(String url, String user, String password)`

In your code, you are passing two `String` arguments: the URL and the password. However, the password should be passed as part of a `Properties` object or as a separate `String` argument along with the username.

To fix this issue, you can modify the `createConnection` method to pass the username and password as separate `String` arguments, like this:

```java
public static Connection createConnection() throws SQLException {
    return DriverManager.getConnection("jdbc:postgresql://localhost:5432/WhitefeatherDB", "Amberyl", "password");
}
```

Or, you can create a `Properties` object to hold the username and password, like this:

```java
public static Connection createConnection() throws SQLException {
    Properties props = new Properties();
    props.setProperty("user", "Amberyl");
    props.setProperty("password", "password");
    return DriverManager.getConnection("jdbc:postgresql://localhost:5432/WhitefeatherDB", props);
}
```

Make sure to replace `"password"` with the actual password for your database.

Note that I'm assuming that the `Amberyl` string is the username, and that you need to provide a password as well. If `Amberyl` is not the username, you'll need to adjust the code accordingly.