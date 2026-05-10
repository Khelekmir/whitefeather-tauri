To implement the `UPDATE` method in the `ShieldRepository`, you need to write a query that updates specific fields of the `Shield` entity. Since your `Shield` entity has relationships with `ShieldClass` and `ShieldMaterial`, you need to handle those updates correctly.

Here’s how you can create an `UPDATE` method to update the fields of a `Shield` entity:

### ShieldRepository.java

```java
package practice.feproj.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import jakarta.transaction.Transactional;
import practice.feproj.backend.entity.Shield;

@Repository
public interface ShieldRepository extends JpaRepository<Shield, String> {

    // READ
    Optional<Shield> findByShieldName(String shieldName);

    List<Shield> findByShieldClass_shieldClassName(String shieldClassName);

    List<Shield> findByMaterial_materialName(String shieldMaterialName);

    List<Shield> findAll();

    // UPDATE
    @Modifying
    @Transactional
    @Query("UPDATE Shield s SET s.shieldClass = :shieldClass, s.material = :material WHERE s.shieldName = :shieldName")
    int updateShield(String shieldName, ShieldClass shieldClass, ShieldMaterial material);

    // DELETE
    Optional<Shield> deleteByShieldName(String shieldName);
}
```

### Explanation

1. **Method Signature**: The `updateShield` method accepts three parameters: `shieldName`, `shieldClass`, and `material`. This allows you to update the `ShieldClass` and `ShieldMaterial` of a `Shield` identified by its `shieldName`.

2. **Query**: The `@Query` annotation defines the JPQL query to update the `Shield` entity. It sets the `shieldClass` and `material` fields where the `shieldName` matches the given parameter.

### Service Layer Adjustment

Now, let's add the corresponding method in the service layer to call this repository method.

```java
package practice.feproj.backend.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import practice.feproj.backend.entity.Shield;
import practice.feproj.backend.entity.ShieldClass;
import practice.feproj.backend.entity.ShieldMaterial;
import practice.feproj.backend.repository.ShieldRepository;

@Service
public class ShieldService {

    private final ShieldRepository shieldRepository;

    public ShieldService(ShieldRepository shieldRepository) {
        this.shieldRepository = shieldRepository;
    }

    public Optional<Shield> getShieldByName(String shieldName) {
        return shieldRepository.findByShieldName(shieldName);
    }

    public List<Shield> getAllShields() {
        return shieldRepository.findAll();
    }

    @Transactional
    public int updateShield(String shieldName, ShieldClass shieldClass, ShieldMaterial material) {
        return shieldRepository.updateShield(shieldName, shieldClass, material);
    }

    public Optional<Shield> deleteShieldByName(String shieldName) {
        return shieldRepository.deleteByShieldName(shieldName);
    }
}
```

### Controller Layer Adjustment

Finally, adjust the controller layer to handle the update request:

```java
package practice.feproj.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import practice.feproj.backend.entity.Shield;
import practice.feproj.backend.entity.ShieldClass;
import practice.feproj.backend.entity.ShieldMaterial;
import practice.feproj.backend.exception.ResourceNotFoundException;
import practice.feproj.backend.service.ShieldService;

import java.util.Optional;

@RestController
@RequestMapping("/api/shields")
public class ShieldController {

    private final Logger logger = LoggerFactory.getLogger(ShieldController.class);
    private final ShieldService shieldService;

    public ShieldController(ShieldService shieldService) {
        this.shieldService = shieldService;
    }

    // CREATE, READ methods here

    // UPDATE
    @PutMapping("/{shieldName}")
    public ResponseEntity<Integer> updateShield(@PathVariable String shieldName, @RequestBody Shield shield) {
        logger.info("Updating Shield with name: {}", shieldName);
        ShieldClass shieldClass = shield.getShieldClass();
        ShieldMaterial material = shield.getMaterial();
        int updatedCount = shieldService.updateShield(shieldName, shieldClass, material);
        if (updatedCount > 0) {
            return new ResponseEntity<>(updatedCount, HttpStatus.OK);
        } else {
            throw new ResourceNotFoundException("Shield not found with name: " + shieldName);
        }
    }

    // DELETE method here
}
```

### Summary

- The `updateShield` method in the `ShieldRepository` updates the `ShieldClass` and `ShieldMaterial` fields of a `Shield` entity identified by its `shieldName`.
- The `ShieldService` provides a method to call the repository’s update method.
- The `ShieldController` handles the HTTP `PUT` request to update the `Shield` entity.

This setup should correctly handle the update functionality for your `Shield` entity.