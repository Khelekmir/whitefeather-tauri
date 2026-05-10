To properly map these SQL tables to entities in a Spring Boot project, each table should correspond to a Java class annotated with JPA/Hibernate annotations. Each class would also require constructors to facilitate object creation. Below are the entity classes and their constructors for the relevant tables:

### 1. `PlayChar` Entity

```java
import jakarta.persistence.*;

@Entity
public class PlayChar {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer playCharId;

    private String name;
    private Integer age;
    private String sex;
    private Integer height;
    private Integer weight;
    private Integer constitution;
    private Integer health;
    private Integer stamina;
    private Integer strength;
    private Integer magic;
    private Integer speed;
    private Integer reflex;
    private Integer luck;

    @ManyToOne
    @JoinColumn(name = "fk_armor_class")
    private Armors armor;

    @ManyToOne
    @JoinColumn(name = "fk_weap")
    private Weapons weapon;

    @ManyToOne
    @JoinColumn(name = "fk_shield")
    private Shields shield;

    @ManyToOne
    @JoinColumn(name = "fk_class")
    private PlayableClasses playableClass;

    // Constructors
    public PlayChar() {}

    public PlayChar(String name, Integer age, String sex, Integer height, Integer weight, Integer constitution, Integer health, Integer stamina, Integer strength, Integer magic, Integer speed, Integer reflex, Integer luck, Armors armor, Weapons weapon, Shields shield, PlayableClasses playableClass) {
        this.name = name;
        this.age = age;
        this.sex = sex;
        this.height = height;
        this.weight = weight;
        this.constitution = constitution;
        this.health = health;
        this.stamina = stamina;
        this.strength = strength;
        this.magic = magic;
        this.speed = speed;
        this.reflex = reflex;
        this.luck = luck;
        this.armor = armor;
        this.weapon = weapon;
        this.shield = shield;
        this.playableClass = playableClass;
    }
}
```

### 2. `Armors` Entity

```java
import jakarta.persistence.*;

@Entity
public class Armors {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer armorClassId;

    private String itemType;
    private Integer armorWeight;
    private Integer armorDefense;
    private Double blockBonus;
    private Double dodgeBonus;
    private Double parryChance;

    // Constructors
    public Armors() {}

    public Armors(String itemType, Integer armorWeight, Integer armorDefense, Double blockBonus, Double dodgeBonus, Double parryChance) {
        this.itemType = itemType;
        this.armorWeight = armorWeight;
        this.armorDefense = armorDefense;
        this.blockBonus = blockBonus;
        this.dodgeBonus = dodgeBonus;
        this.parryChance = parryChance;
    }
}
```

### 3. `Weapons` Entity

```java
import jakarta.persistence.*;

@Entity
public class Weapons {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer weapId;

    private Integer weapClass;
    private Integer weapClassBehavior;

    @ManyToOne
    @JoinColumn(name = "fk_weap_material")
    private WeaponMaterials material;

    // Constructors
    public Weapons() {}

    public Weapons(Integer weapClass, Integer weapClassBehavior, WeaponMaterials material) {
        this.weapClass = weapClass;
        this.weapClassBehavior = weapClassBehavior;
        this.material = material;
    }
}
```

### 4. `Shields` Entity

```java
import jakarta.persistence.*;

@Entity
public class Shields {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer shieldId;

    private String shieldName;

    @ManyToOne
    @JoinColumn(name = "fk_material")
    private ShieldMaterial material;

    @ManyToOne
    @JoinColumn(name = "fk_shield_class")
    private ShieldClass shieldClass;

    // Constructors
    public Shields() {}

    public Shields(String shieldName, ShieldMaterial material, ShieldClass shieldClass) {
        this.shieldName = shieldName;
        this.material = material;
        this.shieldClass = shieldClass;
    }
}
```

### 5. `ShieldMaterial` Entity

```java
import jakarta.persistence.*;

@Entity
public class ShieldMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer materialId;

    private String materialName;
    private Double weightMultiplier;
    private Double blockMultiplier;
    private Double glancingMultiplier;
    private Double durabilityMultiplier;

    // Constructors
    public ShieldMaterial() {}

    public ShieldMaterial(String materialName, Double weightMultiplier, Double blockMultiplier, Double glancingMultiplier, Double durabilityMultiplier) {
        this.materialName = materialName;
        this.weightMultiplier = weightMultiplier;
        this.blockMultiplier = blockMultiplier;
        this.glancingMultiplier = glancingMultiplier;
        this.durabilityMultiplier = durabilityMultiplier;
    }
}
```

### 6. `ShieldClass` Entity

```java
import jakarta.persistence.*;

@Entity
public class ShieldClass {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer shieldClassId;

    private Integer weight;
    private String className;
    private Integer blockValue;
    private Double blockChance;
    private Double glancingChance;
    private Double parryChance;
    private Integer durability;

    // Constructors
    public ShieldClass() {}

    public ShieldClass(Integer weight, String className, Integer blockValue, Double blockChance, Double glancingChance, Double parryChance, Integer durability) {
        this.weight = weight;
        this.className = className;
        this.blockValue = blockValue;
        this.blockChance = blockChance;
        this.glancingChance = glancingChance;
        this.parryChance = parryChance;
        this.durability = durability;
    }
}
```

### 7. `WeaponMaterials` Entity

```java
import jakarta.persistence.*;

@Entity
public class WeaponMaterials {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer weapMaterialId;

    private String materialName;
    private Double weightMultiplier;
    private Double glancingMultiplier;
    private Double durabilityMultiplier;
    private Double piercingMultiplier;

    // Constructors
    public WeaponMaterials() {}

    public WeaponMaterials(String materialName, Double weightMultiplier, Double glancingMultiplier, Double durabilityMultiplier, Double piercingMultiplier) {
        this.materialName = materialName;
        this.weightMultiplier = weightMultiplier;
        this.glancingMultiplier = glancingMultiplier;
        this.durabilityMultiplier = durabilityMultiplier;
        this.piercingMultiplier = piercingMultiplier;
    }
}
```

### 8. `PlayableClasses` Entity

```java
import jakarta.persistence.*;

@Entity
public class PlayableClasses {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer classId;

    private String className;

    // Constructors
    public PlayableClasses() {}

    public PlayableClasses(String className) {
        this.className = className;
    }
}
```

### Summary

Each of these entities maps to a specific table in your PostgreSQL schema. The relationships, such as `ManyToOne`, map the foreign key relationships in your SQL to Java objects, ensuring proper association.