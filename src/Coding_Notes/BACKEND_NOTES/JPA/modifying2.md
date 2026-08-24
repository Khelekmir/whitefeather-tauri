Great question! Since `char1` and `char2` uniquely identify a `CharacterRelationship` by design, you can create an update method that uses these fields instead of `id`.  

---

## **1. Repository Layer**
You'll need a method to find a `CharacterRelationship` by `char1` and `char2`. You can define this in your repository:

```java
@Repository
public interface CharacterRelationshipRepository extends JpaRepository<CharacterRelationship, Integer> {

    // READ
    Optional<CharacterRelationship> findByChar1AndChar2(String char1, String char2);

    // DELETE
    int deleteByChar1AndChar2(String char1, String char2);
}
```
---
## **2. Service Layer**
Now, implement a method in the service layer to find and update the entity:

```java
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import java.util.Optional;

@Service
public class CharacterRelationshipService {

    private final CharacterRelationshipRepository characterRelationshipRepository;

    public CharacterRelationshipService(CharacterRelationshipRepository characterRelationshipRepository) {
        this.characterRelationshipRepository = characterRelationshipRepository;
    }

    @Transactional
    public CharacterRelationship updateRelationshipByCharacters(
            String char1,
            String char2,
            boolean romanticallyCompatible,
            boolean trusted,
            boolean friends,
            boolean lovers,
            boolean married,
            boolean vassal,
            boolean lord,
            Map<String, Object> stats) {

        Optional<CharacterRelationship> optionalRelationship = characterRelationshipRepository.findByChar1AndChar2(char1, char2);

        if (optionalRelationship.isPresent()) {
            CharacterRelationship relationship = optionalRelationship.get();
            relationship.setRomanticallyCompatible(romanticallyCompatible);
            relationship.setTrusted(trusted);
            relationship.setFriends(friends);
            relationship.setLovers(lovers);
            relationship.setMarried(married);
            relationship.setVassal(vassal);
            relationship.setLord(lord);
            relationship.setStats(stats);

            return characterRelationshipRepository.save(relationship);
        } else {
            throw new ResourceNotFoundException("CharacterRelationship not found between " + char1 + " and " + char2);
        }
    }
}
```

---
## **3. Controller Layer**
Now, expose an endpoint to update by `char1` and `char2`:

```java
@PutMapping("/{char1}/{char2}")
public ResponseEntity<CharacterRelationship> updateCharacterRelationship(
        @PathVariable String char1,
        @PathVariable String char2,
        @RequestBody CharacterRelationship newCharacterRelationship) {
    logger.info("Updating CharacterRelationship between: {} and {}", char1, char2);

    CharacterRelationship updatedCharacterRelationship = characterRelationshipService.updateRelationshipByCharacters(
            char1,
            char2,
            newCharacterRelationship.isRomanticallyCompatible(),
            newCharacterRelationship.isTrusted(),
            newCharacterRelationship.isFriends(),
            newCharacterRelationship.isLovers(),
            newCharacterRelationship.isMarried(),
            newCharacterRelationship.isVassal(),
            newCharacterRelationship.isLord(),
            newCharacterRelationship.getStats()
    );

    return ResponseEntity.ok(updatedCharacterRelationship);
}
```

---
## **How It Works**
1. **Repository Layer**
   - Provides a method `findByChar1AndChar2()` to retrieve a relationship by character names.
2. **Service Layer**
   - Retrieves the entity, updates fields, and saves it.
   - Throws a `ResourceNotFoundException` if the relationship does not exist.
3. **Controller Layer**
   - Calls the service with `char1` and `char2` extracted from the URL.
   - Returns the updated entity as a response.

---
## **Why This Works Well**
✅ **Uses `save()`** – No need for a custom update query.  
✅ **Matches your unique constraint** – Uses `char1` and `char2` instead of `id`.  
✅ **More flexible** – Allows updating without needing to know the `id`.  

This approach is clean and fully aligned with Spring Data JPA best practices! 🚀 Would you like any refinements?