The issue arises because the `Spring Data JPA` repository convention does not support an `updateByName` method out of the box. The repository method names follow a certain convention for querying data but updating entities is typically done through the `EntityManager` or using custom repository methods.

In Spring Data JPA, you have a few options for implementing updates:

1. **Using `@Modifying` with `@Query`:**
   You can define custom update queries using JPQL (Java Persistence Query Language) with the `@Modifying` and `@Query` annotations.

2. **Custom Repository Implementation:**
   Create a custom repository implementation to handle the update logic.

Here is how you can implement both approaches:

### Approach 1: Using `@Modifying` with `@Query`

First, add the required imports:

```java
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
```

Then, modify your `PlayCharRepository` to include a custom update method:

```java
@Repository
public interface PlayCharRepository extends JpaRepository<PlayChar, String> {

    // FIND BY
    Optional<PlayChar> findByName(String name);

    List<PlayChar> findBySex(String sex);

    List<PlayChar> findAll();

    // DELETE BY
    Optional<PlayChar> deleteByName(String name);

    // UPDATE BY
    @Modifying
    @Transactional
    @Query("UPDATE PlayChar p SET p = :playChar WHERE p.name = :name")
    int updateByName(String name, PlayChar playChar);

}
```

### Approach 2: Custom Repository Implementation

1. Create a custom repository interface:

```java
public interface PlayCharRepositoryCustom {
    int updateByName(String name, PlayChar playChar);
}
```

2. Implement the custom repository interface:

```java
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.transaction.Transactional;

public class PlayCharRepositoryCustomImpl implements PlayCharRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public int updateByName(String name, PlayChar playChar) {
        String hql = "UPDATE PlayChar p SET p.name = :newName, p.sex = :newSex WHERE p.name = :name";
        return entityManager.createQuery(hql)
                .setParameter("newName", playChar.getName())
                .setParameter("newSex", playChar.getSex())
                .setParameter("name", name)
                .executeUpdate();
    }
}
```

3. Modify your `PlayCharRepository` to extend the custom repository:

```java
@Repository
public interface PlayCharRepository extends JpaRepository<PlayChar, String>, PlayCharRepositoryCustom {

    // FIND BY
    Optional<PlayChar> findByName(String name);

    List<PlayChar> findBySex(String sex);

    List<PlayChar> findAll();

    // DELETE BY
    Optional<PlayChar> deleteByName(String name);
}
```

With either approach, you will be able to update entities in your `PlayCharRepository`.