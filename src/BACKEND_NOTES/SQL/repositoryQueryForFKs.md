The naming convention for the `findByShieldClass_ShieldClassName` method in the repository is a result of how Spring Data JPA handles queries involving nested properties.

### Understanding the Naming Convention

Spring Data JPA uses method name conventions to derive queries directly from the method names. This includes handling nested properties for relationships between entities.

In your `Shield` entity:

```java
@ManyToOne
@JoinColumn(name = "fk_shield_class", referencedColumnName = "className", nullable = false)
private ShieldClass shieldClass;

@ManyToOne
@JoinColumn(name = "fk_material", referencedColumnName = "materialName", nullable = false)
private ShieldMaterial material;
```

The `shieldClass` field is an object of type `ShieldClass`. To query based on a property of `ShieldClass`, you need to specify the path to that property. For example, if `ShieldClass` has a field `className`, you use:

- `shieldClass` to refer to the field in the `Shield` entity.
- `shieldClassName` to refer to the field within the `ShieldClass` entity.

### Breakdown of `findByShieldClass_ShieldClassName`

- **findBy**: Standard prefix indicating a query method.
- **ShieldClass**: The name of the field in the `Shield` entity (`shieldClass`).
- **_**: Separator indicating a nested property.
- **ShieldClassName**: The field in the `ShieldClass` entity (`className`).

Spring Data JPA interprets this method name and generates a query that joins the `Shield` table with the `ShieldClass` table on the `shieldClass` field, then filters by the `className` column in the `ShieldClass` table.

### Example

Given the entities:

- `Shield`:
  ```java
  @ManyToOne
  @JoinColumn(name = "fk_shield_class", referencedColumnName = "className", nullable = false)
  private ShieldClass shieldClass;
  ```
  
- `ShieldClass`:
  ```java
  @Id
  private String className;
  ```

The repository method:

```java
Optional<Shield> findByShieldClass_ShieldClassName(String shieldClassName);
```

This method will generate a query similar to:

```sql
SELECT s FROM Shield s
JOIN s.shieldClass sc
WHERE sc.className = :shieldClassName
```

### Why Not `findByShieldClassName`?

If you simply used `findByShieldClassName`, Spring Data JPA would look for a direct field named `shieldClassName` in the `Shield` entity, which does not exist. Therefore, specifying the full path using the nested property syntax (`ShieldClass_ShieldClassName`) is necessary to indicate the join and the target field within the `ShieldClass` entity.

### Conclusion

The naming convention for repository methods in Spring Data JPA is designed to be expressive and intuitive, leveraging method names to define queries, including handling relationships and nested properties. This makes it possible to write complex queries without needing explicit JPQL or SQL definitions, simplifying the development process and improving code readability.