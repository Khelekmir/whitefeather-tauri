```python
import math

def calculate_value(sensitivity, intensity, preferred_intensity):
    """
    Calculates the value based on sensitivity (0.5 to 9.9), intensity (1 to 10), and preferred_intensity (1 to 10).
    
    The function adheres to the provided guidance using approximate fits:
    - Exponential fits for sensitivity and level scaling.
    - Linear approximation for the difference factor, as it closely matches the ~ percentages.
    """
    # Parameters for exponential fits
    a = 2.25
    b = 0.44
    
    # Normalize for sensitivity (max at 9.9)
    sens_norm = 1 - a * math.exp(-b * 9.9)
    g = (1 - a * math.exp(-b * sensitivity)) / sens_norm
    
    # Normalize for level (max at 10)
    level_norm = 1 - a * math.exp(-b * 10)
    max_level = max(intensity, preferred_intensity)
    l = (1 - a * math.exp(-b * max_level)) / level_norm
    
    # Difference factor (linear approximation matching ~ values)
    diff = abs(intensity - preferred_intensity)
    c = 1 - 0.2 * diff
    
    # Computed value (assuming full positive is 1.0)
    return g * l * c
```