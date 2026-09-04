# Temperature Pocket Deletion

The Grand Composite Curve (GCC) can contain **temperature pockets** — regions where the curve doubles back on itself, creating a local surplus sandwiched between deficits (or vice versa). These pockets represent heat that can be exchanged internally within the process and do **not** need external utility.

Before using the GCC for heat pump integration, these pockets must be removed to obtain the **pocket-free GCC**, which shows only the truly external utility requirement.

---

## What is a Temperature Pocket?

A temperature pocket occurs when a positive $\Delta H$ interval (heat surplus) is immediately followed by a negative $\Delta H$ interval (heat deficit) within the heat cascade — or the reverse. The smaller of the two can be "absorbed" by the larger, because the heat released in the surplus interval can directly satisfy the deficit below it.

Visually on the GCC, a pocket looks like a **bulge** that sticks out and returns. After deletion, the GCC becomes monotonically decreasing from the pinch to the bottom.

---

## Deletion Algorithm

The algorithm walks through the heat cascade intervals and eliminates pockets by **linear interpolation**. Three cases arise when a surplus interval ($\Delta H > 0$) is followed by a deficit ($\Delta H < 0$):

### Case 1: Deficit is smaller than surplus

The deficit interval is fully absorbed. A new temperature boundary is computed by interpolating on the surplus interval's temperature range to find where its cumulative enthalpy equals the post-deficit value:

$$
T_{new} = T_{i} + \frac{T_{i} - T_{i+1}}{H_{exit,i} - H_{exit,i+1}} \times H_{exit,i+2}
$$

The surplus interval shrinks, the deficit interval becomes zero, and the cascade continues.

### Case 2: Surplus is smaller than deficit

The surplus interval is fully absorbed. The interpolation is done on the deficit interval instead:

$$
T_{new} = T_{i+2} + \frac{T_{i+1} - T_{i+2}}{H_{exit,i+1} - H_{exit,i+2}} \times (H_{exit,i} - H_{exit,i+2})
$$

The surplus becomes zero, the deficit shrinks.

### Case 3: Equal magnitude

Both intervals cancel exactly. The intermediate temperature point is removed entirely.

### Iterative cleanup

After resolving one pocket, the algorithm **restarts from the beginning** because removing a pocket may expose a new one. It also handles **zero-width intervals** (consecutive intervals with $\Delta H = 0$) by merging them.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/utility/temperature_pocket_deletion.py</code></summary>

```python
class TemperaturePocketDeletion:
    def delete_temperature_pockets(self):
        # Build working copies of the cascade
        self.heatCascadeexitH = [self.hot_utility]
        for row in self.heat_cascade:
            self.heatCascadedeltaH.append(row['deltaH'])
            self.heatCascadeexitH.append(row['exitH'])

        # Find the pinch (where exitH ≈ 0)
        for i in range(len(self.heatCascadeexitH) - 1):
            if self.heatCascadeexitH[i] <= 1e-22:
                j = i
                break

        # Walk from pinch downward, deleting pockets
        while j < len(self.heatCascadeexitH) - 1:
            if self.heatCascadedeltaH[j] > 0:  # surplus
                if self.heatCascadedeltaH[j + 1] < 0:  # followed by deficit
                    if abs(self.heatCascadedeltaH[j+1]) < abs(self.heatCascadedeltaH[j]):
                        # Case 1: deficit smaller — absorb it
                        self._temperatures[j+1] = (
                            self._temperatures[j]
                            + (self._temperatures[j] - self._temperatures[j+1])
                            / (self.heatCascadeexitH[j] - self.heatCascadeexitH[j+1])
                            * self.heatCascadeexitH[j+2]
                        )
                        self.heatCascadedeltaH[j] = (
                            self.heatCascadeexitH[j+2] - self.heatCascadeexitH[j]
                        )
                        self.heatCascadeexitH[j+1] = self.heatCascadeexitH[j+2]
                        self.heatCascadedeltaH[j+1] = 0.0
                        j = i  # restart from pinch
                    # ... Case 2 and 3 follow the same pattern
```

</details>

---

## Above-Pinch Pockets

The algorithm also handles pockets **above the pinch** (between the top of the cascade and the pinch). These use a separate loop (`u` index) that walks from the top downward to the pinch, applying the same three-case logic.

The above-pinch pass runs after the below-pinch pass, and also restarts whenever a pocket is deleted.

---

## Output

After deletion, the pocket-free cascade is packaged as:

| Key | Content |
|-----|---------|
| `H` | List of cumulative exit enthalpies at each temperature level |
| `deltaH` | List of enthalpy changes per interval |
| `T` | List of temperature boundaries |

This output is used directly by:
- **Heat Pump Integration** — to split into source and sink profiles
- **Total Site Profile** — to build aggregated multi-process profiles
