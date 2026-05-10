

To add a "support relationship" feature that tracks attributes like "trust," "friendship," "aversion," or "romance" between characters, you will need a new table. This table will define relationships between two characters and allow for tracking of the desired metrics.

Here’s how you can structure the new table:

### `character_relationships` Table

```sql
CREATE TABLE IF NOT EXISTS public.character_relationships (
    char1_name character varying NOT NULL, -- The first character in the relationship
    char2_name character varying NOT NULL, -- The second character in the relationship
    relationship_type character varying NOT NULL DEFAULT 'neutral', -- Type of relationship (optional)
    trust integer NOT NULL DEFAULT 0, -- Trust level
    friendship integer NOT NULL DEFAULT 0, -- Friendship level
    aversion integer NOT NULL DEFAULT 0, -- Aversion level
    romance integer NOT NULL DEFAULT 0, -- Romance level
    PRIMARY KEY (char1_name, char2_name),
    FOREIGN KEY (char1_name) REFERENCES public.player_character (name) ON DELETE CASCADE,
    FOREIGN KEY (char2_name) REFERENCES public.player_character (name) ON DELETE CASCADE
);
```

### Key Features:
1. **Two Foreign Keys**: Each record represents a relationship between two characters. The `char1_name` and `char2_name` fields reference the `player_character` table to enforce data integrity.
   
2. **Attributes**: Add columns for `trust`, `friendship`, `aversion`, `romance`, or other metrics to track specific relationship types.

3. **Primary Key**: The composite primary key `(char1_name, char2_name)` ensures that each pair of characters has a unique relationship record.

4. **Optional Relationship Type**: An optional `relationship_type` column can help classify the type of relationship (e.g., allies, rivals).

5. **Bidirectional or Unidirectional**:
   - If relationships are **unidirectional**, this table works as is.
   - For **bidirectional relationships**, you’ll need logic to ensure that updates to one pair (e.g., A->B) are mirrored in the reverse pair (e.g., B->A).

### Example Usage

#### Adding a Relationship
```sql
INSERT INTO public.character_relationships (char1_name, char2_name, trust, friendship)
VALUES ('Alice', 'Bob', 50, 30);
```

#### Updating a Relationship
```sql
UPDATE public.character_relationships
SET trust = trust + 10
WHERE char1_name = 'Alice' AND char2_name = 'Bob';
```

#### Querying Relationships
```sql
SELECT * FROM public.character_relationships
WHERE char1_name = 'Alice' AND char2_name = 'Bob';
```

This design provides flexibility for managing complex inter-character relationships and can be extended further if needed. Let me know if you’d like additional enhancements!