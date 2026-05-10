In Java, the `System.out.printf()` method allows you to print formatted strings using format specifiers. Below is a list of common format specifiers used for different data types:

### **Common Format Specifiers for `System.out.printf()`**

1. **%d** - Decimal (integer)  
   - Example: `System.out.printf("%d", 42);` → Output: `42`

2. **%f** - Floating-point number  
   - Example: `System.out.printf("%.2f", 3.14159);` → Output: `3.14`

3. **%s** - String  
   - Example: `System.out.printf("%s", "Hello");` → Output: `Hello`

4. **%c** - Character  
   - Example: `System.out.printf("%c", 'A');` → Output: `A`

5. **%b** - Boolean  
   - Example: `System.out.printf("%b", true);` → Output: `true`

6. **%x** - Hexadecimal (lowercase)  
   - Example: `System.out.printf("%x", 255);` → Output: `ff`

7. **%X** - Hexadecimal (uppercase)  
   - Example: `System.out.printf("%X", 255);` → Output: `FF`

8. **%o** - Octal  
   - Example: `System.out.printf("%o", 10);` → Output: `12`

9. **%e** - Scientific notation (lowercase)  
   - Example: `System.out.printf("%e", 1234.56);` → Output: `1.234560e+03`

10. **%E** - Scientific notation (uppercase)  
    - Example: `System.out.printf("%E", 1234.56);` → Output: `1.234560E+03`

11. **%%** - Literal % symbol  
    - Example: `System.out.printf("%%");` → Output: `%`

### **Flags for Format Specifiers**
Flags can modify the output:

- **-**: Left-justify the output  
  - Example: `System.out.printf("%-10d", 42);` → Output: `42        `
  
- **+**: Always include a sign (even for positive numbers)  
  - Example: `System.out.printf("%+d", 42);` → Output: `+42`

- **0**: Pad with zeros  
  - Example: `System.out.printf("%05d", 42);` → Output: `00042`

- **,**: Include grouping separators (for numbers)  
  - Example: `System.out.printf("%,d", 1000000);` → Output: `1,000,000`

### **Width and Precision**
You can also specify the width and precision:

- **Width**: The minimum number of characters to output  
  - Example: `System.out.printf("%10d", 42);` → Output: `        42`

- **Precision**: The number of digits after the decimal point for floating-point numbers  
  - Example: `System.out.printf("%.2f", 3.14159);` → Output: `3.14`

These format specifiers give you control over the output format in Java's `System.out.printf()`.