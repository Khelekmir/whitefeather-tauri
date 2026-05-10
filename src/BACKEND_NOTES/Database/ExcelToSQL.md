Certainly! Below is a Java implementation to create an SQL import script based on your Excel data. This uses the Apache POI library to read Excel files and generate SQL `INSERT` statements.

### Prerequisites
1. Add Apache POI dependencies to your `pom.xml` if you haven’t already:
   ```xml
   <dependencies>
       <dependency>
           <groupId>org.apache.poi</groupId>
           <artifactId>poi</artifactId>
           <version>5.2.3</version>
       </dependency>
       <dependency>
           <groupId>org.apache.poi</groupId>
           <artifactId>poi-ooxml</artifactId>
           <version>5.2.3</version>
       </dependency>
   </dependencies>
   ```

2. Make sure your Excel file columns match the database schema.

---

### Java Code to Generate SQL Import Script
```java
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.*;
import java.util.Iterator;

public class ExcelToSQL {
    public static void main(String[] args) {
        // Path to your Excel file and output SQL file
        String excelFilePath = "path/to/your/excel/file.xlsx";
        String sqlFilePath = "path/to/output/playchar_insert.sql";

        try (FileInputStream fis = new FileInputStream(excelFilePath);
             Workbook workbook = new XSSFWorkbook(fis);
             FileWriter writer = new FileWriter(sqlFilePath)) {

            // Get the first sheet from the workbook
            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();

            // Start SQL script
            writer.write("BEGIN;\n");

            // Skip the header row
            if (rowIterator.hasNext()) rowIterator.next();

            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();

                // Read each column value
                String name = getCellValue(row.getCell(0));
                int age = (int) row.getCell(1).getNumericCellValue();
                String description = getCellValue(row.getCell(2));
                String sex = getCellValue(row.getCell(3));
                int height = (int) row.getCell(4).getNumericCellValue();
                int weight = (int) row.getCell(5).getNumericCellValue();
                int constitution = (int) row.getCell(6).getNumericCellValue();
                int health = (int) row.getCell(7).getNumericCellValue();
                int defense = (int) row.getCell(8).getNumericCellValue();
                int resistance = (int) row.getCell(9).getNumericCellValue();
                int stamina = (int) row.getCell(10).getNumericCellValue();
                int strength = (int) row.getCell(11).getNumericCellValue();
                int magic = (int) row.getCell(12).getNumericCellValue();
                int speed = (int) row.getCell(13).getNumericCellValue();
                int skill = (int) row.getCell(14).getNumericCellValue();
                int agility = (int) row.getCell(15).getNumericCellValue();
                int reflex = (int) row.getCell(16).getNumericCellValue();
                int luck = (int) row.getCell(17).getNumericCellValue();
                int movement = (int) row.getCell(18).getNumericCellValue();
                String charClass = getCellValue(row.getCell(19));

                // Build the SQL INSERT statement
                String sql = String.format(
                        "INSERT INTO public.\"PlayChar\" " +
                        "(name, age, char_description, sex, height, weight, constitution, health, defense, " +
                        "resistance, stamina, strength, magic, speed, skill, agility, reflex, luck, movement, " +
                        "fk_class, fk_armor, fk_weap, fk_shield) " +
                        "VALUES ('%s', %d, '%s', '%s', %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, %d, '%s', NULL, NULL, NULL);\n",
                        escapeSingleQuotes(name), age, escapeSingleQuotes(description), sex,
                        height, weight, constitution, health, defense, resistance, stamina, strength,
                        magic, speed, skill, agility, reflex, luck, movement, charClass
                );

                writer.write(sql);
            }

            // End SQL script
            writer.write("COMMIT;\n");

            System.out.println("SQL script generated successfully at: " + sqlFilePath);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Helper method to escape single quotes in SQL strings
    private static String escapeSingleQuotes(String value) {
        return value.replace("'", "''");
    }

    // Helper method to get cell value as a String
    private static String getCellValue(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toString();
                } else {
                    return String.valueOf((int) cell.getNumericCellValue());
                }
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return "";
        }
    }
}
```

---

### How It Works
1. **Input Excel File**: Reads data from the specified `.xlsx` file.
2. **Row Parsing**: Extracts each row and matches the column to the `PlayChar` entity.
3. **SQL Script Generation**:
   - Generates an `INSERT` statement for each row.
   - Escapes single quotes to avoid SQL syntax issues.
4. **Output SQL File**: Writes the SQL commands into a `.sql` file.
5. **Execution**: Run the SQL file in your PostgreSQL database to populate the table.

---

### Output Example
For the data in your Excel:
```sql
BEGIN;
INSERT INTO public."PlayChar" (name, age, char_description, sex, height, weight, constitution, health, defense, resistance, stamina, strength, magic, speed, skill, agility, reflex, luck, movement, fk_class, fk_armor, fk_weap, fk_shield)
VALUES ('Amberyl', 24, 'A quick-witted woman with hidden motives. A bit brazen.', 'F', 66, 141, 5, 21, 5, 8, 52, 7, 9, 12, 10, 7, 7, 30, 'Tactician', NULL, NULL, NULL);
-- Additional rows...
COMMIT;
```

### Next Steps
- Update `excelFilePath` and `sqlFilePath` with your actual file paths.
- Run the Java program to generate the SQL file.
- Execute the SQL script in PostgreSQL. Let me know if you need assistance!