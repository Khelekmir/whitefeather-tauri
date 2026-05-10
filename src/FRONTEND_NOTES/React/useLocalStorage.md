The issue comes from **how you're using the `useLocalStorage` hook**. Specifically, this line is incorrect:

```js
const [character, setCharacter] = useLocalStorage({});
```

### ❌ What's wrong?

Your `useLocalStorage` hook expects **two arguments**:  
```js
useLocalStorage(key: string, initialValue: any)
```

But you're passing **only one argument**, and it's an object `{}`, not a string key. This causes `key` to be `{}` and `initialValue` to be `undefined`. Then:

- `localStorage.getItem({})` becomes `localStorage.getItem("[object Object]")` — which likely returns `null`.
- That makes `savedValue` be `null`, and `initialValue` is `undefined`.
- So `useState(() => getSavedValue(...))` initializes `value` as `undefined`.

That’s why your `character` became `undefined`.

---

### ✅ How to fix it

You need to pass a **string key** and the initial value, like this:

```js
const [character, setCharacter] = useLocalStorage("character", {});
```

This will:
- Check localStorage for a key `"character"`
- If found, use its parsed value
- If not found, initialize with `{}` and store that in localStorage

---

### Optional enhancements
To ensure robustness, you might also want to improve the falsy check in `getSavedValue`:

```js
if (savedValue !== null) return savedValue;
```

Instead of:
```js
if (savedValue) return savedValue;
```

Because `savedValue = false` or `0` would be valid values but are falsy in JavaScript.

Would you like help enhancing the hook to handle things like clearing local storage or syncing across tabs?