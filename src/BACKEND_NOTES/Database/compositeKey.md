If you have a guaranteed unique pairing of `char1_name` and `char2_name` for each entry in `CharacterRelationship`, you can utilize a composite key instead of introducing a surrogate key (`id`). Here's how you can modify your entity to reflect this structure:

1. **Composite Key**: Use `@IdClass` or `@EmbeddedId` to define the composite key of `char1_name` and `char2_name`.
2. **Unique Constraint**: Ensure that `PlayerCharacter.name` has a unique constraint, which matches the SQL schema for `player_character`.

### Updated Entity with Composite Key

Here's the updated `CharacterRelationship` entity using a composite key:

```java
package practice.feproj.backend.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.io.Serializable;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Entity
@Table(name = "character_relationships")
@IdClass(CharacterRelationshipsId.class)
public class CharacterRelationship {

    @Id
    @ManyToOne
    @JoinColumn(name = "char1_name", nullable = false)
    private PlayerCharacter char1;

    @Id
    @ManyToOne
    @JoinColumn(name = "char2_name", nullable = false)
    private PlayerCharacter char2;

    @Column(nullable = false)
    private boolean romanticallyCompatible = false;

    @Column(nullable = false)
    private boolean trusted = false;

    @Column(nullable = false)
    private boolean friends = false;

    @Column(nullable = false)
    private boolean lovers = false;

    @Column(nullable = false)
    private boolean married = false;

    @Column(nullable = false)
    private boolean vassal = false;

    @Column(nullable = false)
    private boolean lord = false;

    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> stats = Map.of();
}
```

### Composite Key Class

This class represents the composite key:

```java
package practice.feproj.backend.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CharacterRelationshipsId implements Serializable {
    private String char1; // Maps to char1_name
    private String char2; // Maps to char2_name
}
```

### Advantages of Using Composite Keys
1. **Enforces Natural Uniqueness**: A composite key directly reflects the business logic that the relationship between two characters is unique.
2. **No Additional Fields**: Avoids the need for a surrogate `id` field, keeping the schema minimal.

### SQL Update

If this isn't already enforced in your database, modify the `character_relationships` table to add a unique composite key constraint:

```sql
ALTER TABLE character_relationships
ADD CONSTRAINT unique_char_pair UNIQUE (char1_name, char2_name);
```

Let me know if you'd prefer a different approach, such as retaining a surrogate key, or if you need further clarification!