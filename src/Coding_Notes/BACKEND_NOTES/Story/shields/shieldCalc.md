Excellent! Let's lay the groundwork for a **formulas-driven shield system** that takes **material** and **size** into account to calculate key gameplay stats like **Block Chance**, **Block Strength**, and **Durability**.

We’ll define formulas that take inputs such as:

* **Material stats**: weight, strength, durability (from the previous table)
* **Shield size factor**: derived from shield type
* Optional: constants or scaling factors to allow tuning for game balance

---

## 🧮 Step 1: Define Material Stats as Variables

Let’s assume each material has these properties (pulled from our prior table):

```plaintext
Material.Weight      → Wm (1 to 6; lower is lighter)
Material.Strength    → Sm (1 to 10)
Material.Durability  → Dm (1 to 10)
```

---

## 📐 Step 2: Define Shield Size Factors

Each shield type contributes to total size, weight, and block potential:

| Shield Type | Size Factor (Fs) | Area Modifier (A) | Block Multiplier (Bs) |
| ----------- | ---------------- | ----------------- | --------------------- |
| Buckler     | 0.5              | 0.5               | 0.6                   |
| Targe       | 0.7              | 0.7               | 0.7                   |
| Heater      | 1.0              | 1.0               | 1.0                   |
| Kite        | 1.3              | 1.3               | 1.2                   |
| Round       | 1.2              | 1.2               | 1.1                   |
| Tower       | 1.6              | 1.6               | 1.5                   |

* `Fs`: scaling factor for block capacity and durability
* `A`: used in area-related logic (weight scaling)
* `Bs`: base block multiplier (affects block % or effectiveness)

---

## 🔧 Step 3: Formulas

### ✅ **1. Total Weight (Tw)**

```plaintext
Tw = A × Wm × BaseWeightScale
```

* `A`: area modifier from shield type
* `Wm`: material weight rating
* `BaseWeightScale`: a tunable constant, e.g., 2.5

> Example: A Kite Shield (A = 1.3) made of Iron (Wm = 6)
> `Tw = 1.3 × 6 × 2.5 = 19.5 weight units`

---

### 🛡️ **2. Block Strength (Bs)**

```plaintext
BlockStrength = Sm × Bs × BlockScale
```

* `Sm`: material strength rating
* `Bs`: block multiplier from shield size
* `BlockScale`: e.g., 10 or 20 — adjusts how much raw block is given

> A Tower Shield (Bs = 1.5) made of Spring Steel (Sm = 8)
> `BlockStrength = 8 × 1.5 × 10 = 120 block power`

---

### ⏳ **3. Durability (Dt)**

```plaintext
Durability = Dm × Fs × DurabilityScale
```

* `Dm`: material durability
* `Fs`: size factor
* `DurabilityScale`: e.g., 15 or 20 for game balance

> Example: Heater Shield (Fs = 1.0) made of Mithril (Dm = 9)
> `Durability = 9 × 1.0 × 15 = 135 durability`

---

## 📘 Summary of Formula Variables

| Variable          | Description                             |
| ----------------- | --------------------------------------- |
| `Wm`              | Material Weight                         |
| `Sm`              | Material Strength                       |
| `Dm`              | Material Durability                     |
| `A`               | Area Modifier (from shield type)        |
| `Fs`              | Size Factor                             |
| `Bs`              | Block Scaling Factor (from shield type) |
| `BaseWeightScale` | Constant to adjust final weight         |
| `BlockScale`      | Constant to scale block power           |
| `DurabilityScale` | Constant to scale final durability      |

---

Would you like a quick spreadsheet-style mockup showing how 2–3 example shields compute out using this system?
