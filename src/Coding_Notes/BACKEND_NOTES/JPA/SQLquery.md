In this case, you **don’t need a custom `@Query`** for deleting because Spring Data JPA can generate the query for you automatically.  

### **Why?**
Spring Data JPA allows you to define delete methods following the naming convention:  
```java
int deleteByChar1AndChar2(String char1, String char2);
```
Since `deleteByChar1AndChar2` follows the standard Spring Data JPA method naming conventions, it will automatically generate the equivalent SQL:

```sql
DELETE FROM character_relationships WHERE char1_name = ? AND char2_name = ?;
```

---

### **When Would You Need a Custom Query?**
You would **only** need a custom `@Query` if:
1. You want to **delete using JPQL with more complex conditions**.
2. You need a **custom return type** (e.g., returning the deleted entity before deletion).
3. You want to **optimize performance** using native SQL instead of JPA’s default deletion.

### **If You Still Prefer a Custom Query**
If you want to explicitly define it, your original approach is **almost correct**, but it needs `@Modifying` and `@Transactional`:

```java
@Modifying
@Query("DELETE FROM CharacterRelationship cr WHERE cr.char1 = :char1 AND cr.char2 = :char2")
int deleteByChar1AndChar2(@Param("char1") String char1, @Param("char2") String char2);
```

Then, in your service layer, you should annotate the delete method with `@Transactional`:

```java
@Transactional
public int removeCharacterRelationship(String char1, String char2) {
    return characterRelationshipRepository.deleteByChar1AndChar2(char1, char2);
}
```

### **Final Recommendation**
For simplicity and maintainability, I recommend **removing the custom query** and just using:
```java
int deleteByChar1AndChar2(String char1, String char2);
```
Spring Data JPA will handle it automatically! 🚀