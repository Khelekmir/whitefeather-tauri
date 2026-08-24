If you are certain that there is only one table on the page, there are several ways you can retrieve the second-to-last row using XPath. Here are **five different approaches**:

### 1. Using `last()-1`
This method targets the second-to-last row directly by leveraging the `last()` function.

```xpath
//table/tbody/tr[last()-1]
```

### 2. Using `preceding-sibling`
You can also use the `preceding-sibling` axis to navigate backward from the last row to the second-to-last row.

```xpath
//table/tbody/tr[last()]/preceding-sibling::tr[1]
```

### 3. Using `position()`
You can calculate the position based on the total number of rows and the `position()` function.

```xpath
//table/tbody/tr[position() = last()-1]
```

### 4. Without `tbody`
If the table does not have a `tbody` element explicitly defined, you can omit `tbody` in the XPath expression:

```xpath
//table/tr[last()-1]
```

### 5. Using `following-sibling`
You can select the first row before the last row using `following-sibling`.

```xpath
//table/tbody/tr[following-sibling::tr[1]]
```

### Summary
Each of these methods will work as long as there is only one table on the page and you want to consistently retrieve the second-to-last row.