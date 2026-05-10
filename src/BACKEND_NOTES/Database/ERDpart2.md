Here's the equivalent SQL without using `ALTER TABLE` statements to add foreign keys afterward. Instead, I've embedded the foreign key constraints directly within the table creation statements. This approach is cleaner and more efficient because it defines the relationships at the time of table creation:

```sql
BEGIN;

DROP TABLE IF EXISTS PlayChar;
DROP TABLE IF EXISTS Armors;
DROP TABLE IF EXISTS ArmorsMaterials;
DROP TABLE IF EXISTS PlayCharClass;
DROP TABLE IF EXISTS PlayCharShields;
DROP TABLE IF EXISTS PlayCharWeapons;
DROP TABLE IF EXISTS Shields;
DROP TABLE IF EXISTS ShieldClass;
DROP TABLE IF EXISTS ShieldMaterials;
DROP TABLE IF EXISTS Weapons;
DROP TABLE IF EXISTS WeaponMaterials;
DROP TABLE IF EXISTS PlayableClasses;

-- Create PlayChar table with foreign keys
CREATE TABLE IF NOT EXISTS public."PlayChar"
(
    play_char_id serial NOT NULL,
    name character varying NOT NULL,
    age integer NOT NULL,
    sex character varying NOT NULL,
    height integer NOT NULL,
    weight integer NOT NULL,
    constitution integer NOT NULL,
    health integer NOT NULL,
    stamina integer NOT NULL,
    strength integer NOT NULL,
    magic integer NOT NULL,
    speed integer NOT NULL,
    reflex integer NOT NULL,
    luck integer NOT NULL,
    fk_armor_class integer NOT NULL,
    fk_weap integer NOT NULL,
    fk_shield integer NOT NULL,
    fk_class integer NOT NULL,
    PRIMARY KEY (play_char_id),
    UNIQUE (fk_armor_class),
    UNIQUE (fk_weap),
    UNIQUE (fk_shield),
    UNIQUE (fk_class),
    CONSTRAINT fk_armor FOREIGN KEY (fk_armor_class) REFERENCES public."Armors" (armor_class_id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_weap FOREIGN KEY (fk_weap) REFERENCES public."Weapons" (weap_id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_shield FOREIGN KEY (fk_shield) REFERENCES public."Shields" (shield_id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_class FOREIGN KEY (fk_class) REFERENCES public."PlayableClasses" (class_id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- Create Armors table
CREATE TABLE IF NOT EXISTS public."Armors"
(
    armor_class_id serial NOT NULL,
    armor_type character varying NOT NULL,
    armor_weight integer NOT NULL,
    armor_defense integer NOT NULL,
    block_bonus double precision NOT NULL,
    dodge_bonus double precision NOT NULL,
    parry_chance double precision NOT NULL,
    PRIMARY KEY (armor_class_id)
);

-- Create Weapons table with foreign keys
CREATE TABLE IF NOT EXISTS public."Weapons"
(
    weap_id serial NOT NULL,
    weap_class integer NOT NULL,
    weap_class_behavior integer NOT NULL,
    fk_weap_material integer NOT NULL,
    PRIMARY KEY (weap_id),
    UNIQUE (fk_weap_material),
    CONSTRAINT fk_weap_material FOREIGN KEY (fk_weap_material) REFERENCES public."WeaponMaterials" (weap_material_id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- Create Shields table with foreign keys
CREATE TABLE IF NOT EXISTS public."Shields"
(
    shield_id serial NOT NULL,
    shield_name character varying(255) NOT NULL,
    fk_material integer NOT NULL,
    fk_shield_class integer NOT NULL,
    UNIQUE (fk_material),
    UNIQUE (fk_shield_class),
    CONSTRAINT fk_material FOREIGN KEY (fk_material) REFERENCES public."ShieldMaterials" (material_id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT fk_shield_class FOREIGN KEY (fk_shield_class) REFERENCES public."ShieldClass" (shield_class_id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- Comment on Shields table
COMMENT ON TABLE public."Shields"
    IS 'hit penalty has been removed, as this should be worked in through weight';

-- Create ShieldMaterials table
CREATE TABLE IF NOT EXISTS public."ShieldMaterials"
(
    material_id serial NOT NULL,
    material_name character varying(255) NOT NULL,
    weight_multiplier double precision NOT NULL,
    block_multiplier double precision NOT NULL,
    glancing_multiplier double precision NOT NULL,
    durability_multiplier double precision NOT NULL,
    PRIMARY KEY (material_id)
);

-- Create ShieldClass table
CREATE TABLE IF NOT EXISTS public."ShieldClass"
(
    shield_class_id serial NOT NULL,
    weight integer NOT NULL,
    class_name character varying(255) NOT NULL,
    block_value integer NOT NULL,
    block_chance double precision NOT NULL,
    glancing_chance double precision NOT NULL,
    parry_chance double precision NOT NULL,
    durability integer NOT NULL,
    PRIMARY KEY (shield_class_id)
);

-- Create WeaponMaterials table
CREATE TABLE IF NOT EXISTS public."WeaponMaterials"
(
    weap_material_id serial NOT NULL,
    material_name character varying(255) NOT NULL,
    weight_multiplier double precision NOT NULL,
    glancing_multiplier double precision NOT NULL,
    durability_multiplier double precision NOT NULL,
    piercing_multiplier double precision NOT NULL,
    PRIMARY KEY (weap_material_id)
);

-- Create PlayableClasses table
CREATE TABLE IF NOT EXISTS public."PlayableClasses"
(
    class_id serial NOT NULL,
    class_name character varying(255) NOT NULL,
    PRIMARY KEY (class_id)
);

END;
```

### Key Changes:
1. **Foreign Key Constraints Inline**: Foreign key constraints are now defined directly inside the `CREATE TABLE` statements for each table, instead of using separate `ALTER TABLE` statements afterward. For example:
   ```sql
   CONSTRAINT fk_armor FOREIGN KEY (fk_armor_class) REFERENCES public."Armors" (armor_class_id) ON UPDATE NO ACTION ON DELETE NO ACTION
   ```
   This is placed within the `PlayChar` table definition, linking the `fk_armor_class` column to the `armor_class_id` column of the `Armors` table.

2. **Cleaner Structure**: This approach reduces the need for separate `ALTER TABLE` blocks, making the script easier to read and reducing the likelihood of foreign key violations during the initial creation phase.

3. **Table and Column References**: All relationships are maintained between tables (e.g., `Weapons`, `Shields`, `PlayableClasses`), so integrity constraints are enforced directly upon table creation.

This new version accomplishes the same functionality, but in a more concise and efficient manner.