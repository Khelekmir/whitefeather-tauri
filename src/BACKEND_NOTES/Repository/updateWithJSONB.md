Updating JSONB fields like `combatStats` using a **JPQL query** requires special handling because JPQL doesn't natively support JSON types. However, since PostgreSQL supports JSONB, you can use **native SQL queries** within Spring Data JPA.  

---

### **Step 1: Update `PlayerCharacterRepository`**
Modify the repository to include a **native query** for updating `combatStats`:

```java
@Repository
public interface PlayerCharacterRepository extends JpaRepository<PlayerCharacter, Integer> {

    @Modifying
    @Transactional
    @Query(value = "UPDATE player_character SET combat_stats = CAST(:combatStats AS jsonb) WHERE id = :id", nativeQuery = true)
    int updateCombatStats(@Param("id") int id, @Param("combatStats") String combatStats);
}
```

### **Step 2: Update the Service Layer**
Since JSON data is being passed as a `String`, you'll need to **serialize the `Map<String, Object>` to a JSON string** before calling the repository method.

```java
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@Transactional
public class PlayerCharacterService {

    private final Logger logger = LoggerFactory.getLogger(PlayerCharacterService.class);
    private final PlayerCharacterRepository playerCharacterRepository;
    private final ObjectMapper objectMapper;  // Jackson ObjectMapper for JSON conversion

    public PlayerCharacterService(PlayerCharacterRepository playerCharacterRepository, ObjectMapper objectMapper) {
        this.playerCharacterRepository = playerCharacterRepository;
        this.objectMapper = objectMapper;
    }

    public void updateCombatStats(int playerCharacterId, Map<String, Object> combatStats) {
        logger.info("Updating combatStats for PlayerCharacter with id: {}", playerCharacterId);

        try {
            String combatStatsJson = objectMapper.writeValueAsString(combatStats);
            playerCharacterRepository.updateCombatStats(playerCharacterId, combatStatsJson);
        } catch (JsonProcessingException e) {
            logger.error("Error converting combatStats to JSON", e);
            throw new RuntimeException("Failed to convert combatStats to JSON", e);
        }
    }
}
```

---

### **How This Works**
1. **Repository Layer (`@Query`)**
   - Uses a **native SQL query** (`UPDATE player_character SET combat_stats = CAST(:combatStats AS jsonb)`)
   - Updates only the `combat_stats` column without affecting other fields.
   - Takes the JSON as a `String` parameter and explicitly casts it as `jsonb` in PostgreSQL.

2. **Service Layer**
   - Converts `Map<String, Object>` to a `String` (valid JSON) using `ObjectMapper`.
   - Calls the repository method to update the field in the database.

---

### **Step 3: Repeat for Other JSON Fields**
You can create similar methods for `lewdStats`, `tradeSkills`, and `misc`.

#### **Repository**
```java
@Modifying
@Transactional
@Query(value = "UPDATE player_character SET lewd_stats = CAST(:lewdStats AS jsonb) WHERE id = :id", nativeQuery = true)
int updateLewdStats(@Param("id") int id, @Param("lewdStats") String lewdStats);

@Modifying
@Transactional
@Query(value = "UPDATE player_character SET trade_skills = CAST(:tradeSkills AS jsonb) WHERE id = :id", nativeQuery = true)
int updateTradeSkills(@Param("id") int id, @Param("tradeSkills") String tradeSkills);

@Modifying
@Transactional
@Query(value = "UPDATE player_character SET misc = CAST(:misc AS jsonb) WHERE id = :id", nativeQuery = true)
int updateMisc(@Param("id") int id, @Param("misc") String misc);
```

#### **Service**
```java
public void updateLewdStats(int playerCharacterId, Map<String, Object> lewdStats) {
    logger.info("Updating lewdStats for PlayerCharacter with id: {}", playerCharacterId);
    try {
        String lewdStatsJson = objectMapper.writeValueAsString(lewdStats);
        playerCharacterRepository.updateLewdStats(playerCharacterId, lewdStatsJson);
    } catch (JsonProcessingException e) {
        logger.error("Error converting lewdStats to JSON", e);
        throw new RuntimeException("Failed to convert lewdStats to JSON", e);
    }
}

public void updateTradeSkills(int playerCharacterId, Map<String, Object> tradeSkills) {
    logger.info("Updating tradeSkills for PlayerCharacter with id: {}", playerCharacterId);
    try {
        String tradeSkillsJson = objectMapper.writeValueAsString(tradeSkills);
        playerCharacterRepository.updateTradeSkills(playerCharacterId, tradeSkillsJson);
    } catch (JsonProcessingException e) {
        logger.error("Error converting tradeSkills to JSON", e);
        throw new RuntimeException("Failed to convert tradeSkills to JSON", e);
    }
}

public void updateMisc(int playerCharacterId, Map<String, Object> misc) {
    logger.info("Updating misc for PlayerCharacter with id: {}", playerCharacterId);
    try {
        String miscJson = objectMapper.writeValueAsString(misc);
        playerCharacterRepository.updateMisc(playerCharacterId, miscJson);
    } catch (JsonProcessingException e) {
        logger.error("Error converting misc to JSON", e);
        throw new RuntimeException("Failed to convert misc to JSON", e);
    }
}
```

---

### **Benefits of This Approach**
✅ **Efficient** – Updates only the necessary JSON field instead of fetching and saving the entire entity.  
✅ **Prevents Overwrites** – Does not replace the whole entity, just modifies a single column.  
✅ **Performance Boost** – Avoids loading the entity into memory before updating.  

Would you like help with writing controller endpoints for these updates? 🚀