# Total Site Profile

The Total Site Profile (TSP) extends Pinch Analysis from a **single process** to an **entire industrial site** with multiple processes. It aggregates the individual pocket-free Grand Composite Curves into a single pair of site-level hot and cold utility profiles.

This enables identifying heat exchange opportunities **between different processes** — not just within one process — and is a prerequisite for designing a shared utility system.

---

## Overview

Each process on the site has already been analysed individually through Pinch Analysis. Its pocket-free GCC has been split into:
- A **hot profile** (heat released, above the pinch)
- A **cold profile** (heat demanded, below the pinch)

The TSP aggregates these profiles by **summing the enthalpy contributions** from all processes at each temperature level.

---

## Step 1 — Collect All Process Temperatures

For each process, the hot and cold temperatures from the split GCC are collected into a master list. The algorithm tracks which process and which stream segment each temperature belongs to, using a **construction aid table**:

| Temperature | Process index | Stream segment index |
|-------------|---------------|---------------------|
| 180°C | [0, 2] | [0, 1] |
| 150°C | [0] | [1] |
| 120°C | [1, 2] | [0, 0] |

When the same temperature appears in multiple processes, the entries are merged (not duplicated).

After collection, the master temperature list is **sorted** and **deduplicated**.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/total_site_profile/total_site_profile.py</code> (lines 95–127)</summary>

```python
def construct_total_site_profile(self, localisation):
    # Collect all hot temperatures across processes
    for i in range(len(self.splitdict['HotTemperatures'])):
        for j in range(len(self.splitdict['HotTemperatures'][i])):
            T = self.splitdict['HotTemperatures'][i][j]
            self.tstHotTemperatures.append(T)

            if T not in self.tstHotConstructionAid['T']:
                self.tstHotConstructionAid['T'].append(T)
                self.tstHotConstructionAid['Process'].append([i])
                self.tstHotConstructionAid['Stream'].append([j])
            else:
                idx = self.tstHotConstructionAid['T'].index(T)
                self.tstHotConstructionAid['Process'][idx].append(i)
                self.tstHotConstructionAid['Stream'][idx].append(j)

    self.tstHotTemperatures = sorted(set(self.tstHotTemperatures))
    # Same logic for cold temperatures...
```

</details>

---

## Step 2 — Compute Slopes (Enthalpy Gradients)

For each process and each temperature segment, the **slope** (enthalpy per degree) is computed:

$$
\text{Slope}_{i,j} = \frac{\Delta H_{i,j}}{\Delta T_{i,j}} = \frac{H_{j} - H_{j+1}}{T_{j} - T_{j+1}}
$$

This slope represents the **heat capacity flow rate** of that segment — how many kW are released (or absorbed) per degree of temperature change.

Special cases:
- If $\Delta T = 0$ (isothermal segment like a phase change), the slope is set to 0.
- If the enthalpy change has the wrong sign (e.g., cold profile releasing heat), the slope is forced to 0 to avoid unphysical contributions.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/total_site_profile/total_site_profile.py</code> (lines 129–150)</summary>

```python
# Compute slopes for cold profiles
Steigung = []  # "Steigung" = slope
for Prozess in range(len(self.splitdict['ColdTemperatures'])):
    for Temp in range(len(self.splitdict['ColdTemperatures'][Prozess]) - 1):
        dT = (self.splitdict['ColdTemperatures'][Prozess][Temp]
              - self.splitdict['ColdTemperatures'][Prozess][Temp+1])
        dH = (self.splitdict['ColdH'][Prozess][Temp]
              - self.splitdict['ColdH'][Prozess][Temp+1])

        if dT == 0:
            Steigung.append(0.0)
        elif dH < 0:  # wrong sign — not a real cold demand
            Steigung.append(0.0)
        else:
            Steigung.append(dH / dT)
    self.splitdict['SteigungCold'].append(Steigung)
    Steigung = []

# Same pattern for hot profiles...
```

</details>

---

## Step 3 — Aggregate Across Processes

For each temperature in the master list, the algorithm looks at **every process** and determines whether that process has an active stream segment at that temperature. If so, it adds the corresponding slope × temperature interval to the cumulative enthalpy.

The key logic is:

1. Walk through the master temperatures in order.
2. For each process, find which segment contains the current temperature.
3. Multiply that segment's slope by the temperature interval since the last master temperature.
4. Sum contributions from all processes.
5. Append the cumulative total to the site profile.

The hot profile is built from cold to hot (ascending temperature), while the cold profile is built similarly. At the end:
- The hot profile is **flipped** so it starts at 0 and increases with decreasing temperature (matching the GCC convention).
- The cold profile accumulates naturally from 0 upward.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/total_site_profile/total_site_profile.py</code> (lines 152–218)</summary>

```python
# Aggregate hot profile across all processes
kW = 0.0
for Temperatur in self.tstHotTemperatures:
    for Prozess in reversed(range(len(self.splitdict['HotTemperatures']))):
        # Skip if process has no data or doesn't reach this temperature
        if self.splitdict['HotTemperatures'][Prozess][-1] >= Temperatur:
            continue

        # Find which segment of this process contains the temperature
        for Prozesstemperatur in reversed(range(len(...))):
            if Temperatur == self.splitdict['HotTemperatures'][Prozess][...]:
                # Exact match — use the full segment
                kW += slope * (T_segment - T_next)
                break
            elif Temperatur falls within the segment:
                # Partial match — use (T - last_T) portion
                kW += slope * (Temperatur - last_temperature)
                break

    # Accumulate
    self.tstHotH.append(
        self.tstHotH[-1] + kW if self.tstHotH else kW
    )
    kW = 0.0
    letzteTemperaturHot = Temperatur  # "letzte" = last/previous

# Flip the hot profile: start at 0 at the hot end
maxHot = self.tstHotH[-1]
self.tstHotH = [-(value - maxHot) for value in self.tstHotH]
```

</details>

---

## Output

The Total Site Profile produces two curves:

| Curve | X-axis | Y-axis | Meaning |
|-------|--------|--------|---------|
| **Site hot profile** | Enthalpy (kW) | Temperature (°C) | Total heat released across all processes, aggregated by temperature |
| **Site cold profile** | Enthalpy (kW) | Temperature (°C) | Total heat demanded across all processes, aggregated by temperature |

The overlap between these profiles represents the **maximum inter-process heat recovery** achievable through a shared utility network (e.g., a steam system). The non-overlapping portions define the **site-level utility requirements**.
