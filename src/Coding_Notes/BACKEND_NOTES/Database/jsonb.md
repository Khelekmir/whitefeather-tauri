Using `JSONB` in Java for a JPA entity is possible, but it requires some additional setup because JPA does not natively support JSON or JSONB columns. You can use libraries like **Hibernate** (with its `@Type` annotation) or integrate with Jackson for JSON processing.

Here’s how you can proceed:

### 1. Add the Required Dependencies
Ensure your `pom.xml` includes dependencies for Hibernate Types or Jackson. For Hibernate Types:
```xml
<dependency>
    <groupId>com.vladmihalcea</groupId>
    <artifactId>hibernate-types-52</artifactId>
    <version>2.21.1</version>
</dependency>
```

### 2. Annotate the JSONB Fields
Update your `PlayerCharacter` class to include JSONB fields. You can use `@Type` from Hibernate Types for this purpose. Example:

```java
package practice.feproj.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Entity
@Table(name = "player_character")
public class PlayerCharacter {
    @Id
    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String sex = "female";

    @Column(nullable = false)
    private int age = 18;

    @Column(nullable = false)
    private int height = 66;

    @Column(nullable = false)
    private int weight = 141;

    @Column(length = 255, nullable = false)
    private String description = "";

    @Type(type = "jsonb")
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> combatStats;

    @Type(type = "jsonb")
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> lewdStats;

    @Type(type = "jsonb")
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> tradeSkills;

    @Column(nullable = false)
    private int mainhand = 1;

    @Column(nullable = false)
    private int offhand = 1;

    @Column(nullable = false)
    private int head = 1;

    @Column(nullable = false)
    private int neck = 1;

    @Column(nullable = false)
    private int shoulder = 1;

    @Column(nullable = false)
    private int chest = 1;

    @Column(nullable = false)
    private int shirt = 1;

    @Column(nullable = false)
    private int wrist = 1;

    @Column(nullable = false)
    private int hand = 1;

    @Column(nullable = false)
    private int waist = 1;

    @Column(nullable = false)
    private int underwear = 1;

    @Column(nullable = false)
    private int leg = 1;

    @Column(nullable = false)
    private int foot = 1;

    @Column(nullable = false)
    private int ring1 = 1;

    @Column(nullable = false)
    private int ring2 = 1;

    @Column(nullable = false)
    private int trinket1 = 1;

    @Column(nullable = false)
    private int trinket2 = 1;

    @Type(type = "jsonb")
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> misc;
}
```

### Explanation
1. **`@Type(type = "jsonb")`**: This annotation from Hibernate Types maps a field to a PostgreSQL `JSONB` column.
2. **`@Column(columnDefinition = "jsonb")`**: Specifies that the column is of type `JSONB`.
3. **Field Type**: Use `Map<String, Object>` for JSONB fields. You can also use custom classes if you prefer strongly typed data, but then you'll need to ensure proper serialization/deserialization.

### 3. Configure Hibernate
Ensure Hibernate is set up to support `jsonb` mapping. No additional configuration is needed if you use the Hibernate Types library.

### 4. Example JSON Data
Here's an example of what data might look like:
- `combatStats`: `{ "strength": 10, "dexterity": 8, "intelligence": 6 }`
- `lewdStats`: `{ "charisma": 5, "flirtation": 7 }`
- `tradeSkills`: `{ "blacksmithing": 4, "alchemy": 9 }`

### 5. Persisting and Fetching Data
You can now persist and fetch entities using your repository layer as usual, and Hibernate will handle the conversion between Java objects and JSONB.

This approach allows you to work with structured JSON data seamlessly while storing it in PostgreSQL.