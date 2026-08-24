In Visual Studio Code (VS Code), there is no built-in keyboard shortcut to automatically break a string into concatenated parts and split it across multiple lines in a `.java` file. However, you can achieve this using an extension or by writing a custom snippet.

Here's how you can manually create a custom keyboard shortcut with a multi-step approach using tasks or macros:

1. **Install the "Macros" extension**:
   - Open the Extensions view by pressing `Ctrl+Shift+X`.
   - Search for "Macros" by "Geddski" and install it.

2. **Configure a macro to split the string**:
   - Open your `keybindings.json` file by pressing `Ctrl+Shift+P` and typing "Open Keyboard Shortcuts (JSON)".
   - Add the following configuration to create a macro for splitting the string:

     ```json
     {
       "key": "ctrl+alt+s",
       "command": "macros.splitString",
       "when": "editorTextFocus && editorLangId == 'java'"
     }
     ```

3. **Configure the macro steps**:
   - Open your `settings.json` file by pressing `Ctrl+Shift+P` and typing "Preferences: Open Settings (JSON)".
   - Add the following configuration to define the macro steps:

     ```json
     "macros": {
       "splitString": [
         "editor.action.insertLineAfter",
         "cursorUp",
         "editor.action.clipboardCutAction",
         "cursorEnd",
         "type \"+ \"",
         "cursorDown",
         "type \"\""
       ]
     }
     ```

This macro does the following:
- Creates a new line below the current line.
- Moves the cursor up to the original line.
- Cuts the text after the cursor position.
- Moves the cursor to the end of the line.
- Adds a `+` symbol.
- Moves the cursor to the new line.
- Adds the cut text as a new string.

To use this macro:
- Place the cursor where you want to split the string.
- Press `Ctrl+Alt+S` (or your chosen key combination).

If you prefer an extension that might simplify this process further, consider using an extension like "Split String" or similar, which may have built-in commands for string manipulation.

### Example

Before using the macro:
```java
String example = "example string";
```

After using the macro (with the cursor between "example" and "string"):
```java
String example = "example " + 
                 "string";
```