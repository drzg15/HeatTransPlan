# ISSP — Inter-Site Storage Profile

The ISSP (Inter-Site Storage Profile) module sizes **thermal energy storage** (TES) for batch processes. When a heat pump integrates waste heat into a process that operates in batches, the heat source and sink may not be available at the same time. A storage system bridges this gap.

The module designs two types of storage:
- **Stratified hot water tank** (evaporator side)
- **Steam accumulator / Ruths storage** (condenser side)

---

## Context: Batch Processes

In a batch process, streams are active for a limited time ($t_{batch}$, in hours). All energy quantities are converted from power (kW) to energy per batch (kWh):

$$
E_{batch} = \dot{Q} \times t_{batch}
$$

where $t_{batch} = t_{seconds} / 3600$.

The composite curves, originally in kW, are scaled to kWh for the entire batch.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/issp/issp.py</code> (lines 22–33)</summary>

```python
def __init__(self, ...):
    # Convert batch time to hours
    self.t = batchtime_seconds / 3600

def cc_in_kwh(self):
    """Convert composite curves from kW to kWh per batch."""
    for i in range(len(self.CC['hot']['H'])):
        self.CC['hot']['H'][i] = self.CC['hot']['H'][i] * self.t
    self.CC['hot']['kWh'] = self.CC['hot']['H']
    del self.CC['hot']['H']

    for i in range(len(self.CC['cold']['H'])):
        self.CC['cold']['H'][i] = self.CC['cold']['H'][i] * self.t
    self.CC['cold']['kWh'] = self.CC['cold']['H']
    del self.CC['cold']['H']
```

</details>

---

## Temperature Corrections

The heat pump requires temperature differences (approach temperatures) at both the evaporator and condenser to drive heat transfer. These corrections depend on whether the heat pump is connected **at the pinch** or **away from the pinch**:

| Connection | Evaporator-side correction | Condenser-side correction |
|---|---|---|
| At the pinch | $1.25 \times \Delta T_{min}$ | $1.25 \times \Delta T_{min}$ |
| Away from the pinch | $0.25 \times \Delta T_{min}$ | $0.25 \times \Delta T_{min}$ |

An **intermediate circuit** (water loop between the process and the heat pump) adds an additional temperature drop of:

$$
\Delta T_{intermediate} = \frac{2}{4} \times \Delta T_{min} = 0.5 \times \Delta T_{min} \quad \text{(evaporator side)}
$$

$$
\Delta T_{intermediate} = \frac{3}{4} \times \Delta T_{min} = 0.75 \times \Delta T_{min} \quad \text{(condenser side)}
$$

<details>
<summary><b>Source code:</b> <code>backend/app/modules/issp/issp.py</code> (lines 38–48)</summary>

```python
def draw_issp_hot_intermediate(self):
    """Evaporator-side storage design."""
    if self.from_pinch:
        self.TemperaturKorrektur = 1.25 * self.deltaTmin
    else:
        self.TemperaturKorrektur = 0.25 * self.deltaTmin

    deltaTZwischenkreislauf = 2/4 * self.deltaTmin  # intermediate circuit
    self.DifferenzHot = (
        self.CC['hot']['kWh'][-1]
        - self.integration_point['QQuelle'][0] * self.t
    )
```

</details>

---

## Hot Water Tank Sizing (Evaporator Side)

The stratified hot water storage tank bridges the evaporator-side energy. Its volume is calculated from:

$$
V_{tank} = \frac{\dot{Q}_{evaporator} \times t_{batch} \times 3600}{c_p \times \Delta T_{storage} \times 1000}
$$

where:
- $\dot{Q}_{evaporator} \times t_{batch}$ = energy per batch (kWh → kJ via ×3600)
- $c_p = 4.18$ kJ/(kg·K) for water
- $\Delta T_{storage}$ = temperature difference between the hot and cold layers of the stratified tank
- Division by 1000 converts litres to m³

The temperature of the hot layer is determined by interpolating on the hot composite curve at the point where the heat pump begins extracting heat. The cold layer temperature accounts for the intermediate circuit temperature drop.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/issp/issp.py</code> (lines 49–64)</summary>

```python
# Find the hot composite temperature at the start of the HP zone
for i in range(len(self.CC['hot']['T'])):
    if self.CC['hot']['T'][i] >= self.integration_point['Temp'][-1]:
        m = (self.CC['hot']['T'][i-1]
             + (self.CC['hot']['T'][i] - self.CC['hot']['T'][i-1])
             / (self.CC['hot']['kWh'][i] - self.CC['hot']['kWh'][i-1])
             * (self.DifferenzHot - self.CC['hot']['kWh'][i-1]))
        if m != 0:
            break

# Tank volume (m³)
self.VolumenWWSpeicher = round(
    self.integration_point['QQuelle'][0] * self.t * 3600
    / (4.18 * (ZwischenkreislaufTemp - (m - deltaTZwischenkreislauf)))
    / 1000,
    1
)
```

</details>

---

## Steam Accumulator Sizing (Condenser Side)

The condenser side uses a **steam accumulator** (Ruths storage) — a pressurized vessel that stores energy in the form of pressurized hot water, flashing to steam when pressure is released.

### Steam mass

The mass of steam required to deliver the condenser-side energy is:

$$
m_{steam} = \frac{\dot{Q}_{condenser} \times t_{batch} \times 3600}{\Delta h_{latent}(T_S)}
$$

where $\Delta h_{latent}(T_S)$ is the latent heat of vaporization at the storage temperature $T_S$, obtained from CoolProp thermodynamic properties.

### Storage volume

The accumulator volume uses the **Glück method** (reference: berndglueck.de/Waermespeicher):

$$
V_{accumulator} = \frac{m_{steam}}{\frac{\phi}{v'_1} \cdot \frac{h'_1 - h'_2}{0.5 \cdot (h''_1 + h''_2) - h'_2}}
$$

where:
- $\phi = 0.9$ is the **fill factor** (fraction of the vessel filled with liquid)
- $v'_1 = 1 / \rho_{liquid}(T_S)$ is the specific volume of saturated liquid at storage temperature
- $h'_1, h''_1$ are the saturated liquid and vapor enthalpies at the **storage** temperature $T_S$
- $h'_2, h''_2$ are the saturated liquid and vapor enthalpies at the **process** temperature $T_{process}$

All thermodynamic properties are computed via CoolProp:

<details>
<summary><b>Source code:</b> <code>backend/app/modules/utility/thermodynamic_properties.py</code></summary>

```python
from CoolProp.CoolProp import PropsSI

class ThermodynamicProperties():
    def get_h_prime(T, fluid='Water'):
        """Saturated liquid enthalpy h' at temperature T."""
        TK = float(T) + 273.15
        return PropsSI('H', 'T', TK, 'Q', 0, fluid) / 1000  # kJ/kg

    def get_h_double_prime(T, fluid='Water'):
        """Saturated vapor enthalpy h'' at temperature T."""
        TK = float(T) + 273.15
        return PropsSI('H', 'T', TK, 'Q', 1, fluid) / 1000  # kJ/kg

    def get_v_prime(T, fluid='Water'):
        """Specific volume of saturated liquid at temperature T."""
        TK = float(T) + 273.15
        rho_liq = PropsSI('D', 'T', TK, 'Q', 0, fluid)  # kg/m³
        return 1 / rho_liq  # m³/kg

    def get_latent_heat(T, fluid='Water'):
        """Latent heat of vaporization at temperature T."""
        TK = float(T) + 273.15
        return (PropsSI('H', 'T', TK, 'Q', 1, fluid) / 1000
                - PropsSI('H', 'T', TK, 'Q', 0, fluid) / 1000)  # kJ/kg
```

</details>

<details>
<summary><b>Source code:</b> <code>backend/app/modules/issp/issp.py</code> (lines 99–116)</summary>

```python
def draw_issp_cold_intermediate(self):
    """Condenser-side storage design."""
    deltaTZwischenkreislauf = 3/4 * self.deltaTmin

    # Steam mass required
    self.Dampfmasse = (
        self.integration_point['QSenke'][0] * self.t * 3600
    ) / Props.get_latent_heat(self.TS)

    # Thermodynamic properties at storage and process temperatures
    h1_prime = Props.get_h_prime(self.TS)           # h' at T_storage
    h1_double_prime = Props.get_h_double_prime(self.TS)  # h'' at T_storage
    v1_prime = Props.get_v_prime(self.TS)            # v' at T_storage
    h2_prime = Props.get_h_prime(self.TProcess)      # h' at T_process
    h2_double_prime = Props.get_h_double_prime(self.TProcess)  # h'' at T_process

    Füllgrad = 0.9  # fill factor

    # Accumulator volume (Glück method)
    self.VolumenDampfSpeicher = round(
        self.Dampfmasse / (
            (Füllgrad / v1_prime)
            * ((h1_prime - h2_prime)
               / (0.5 * (h1_double_prime + h2_double_prime) - h2_prime))
        ),
        1
    )
```

</details>

---

## Summary of ISSP Outputs

| Output | Unit | Description |
|--------|------|-------------|
| Hot water tank volume | m³ | Stratified TES for the evaporator side |
| Steam accumulator volume | m³ | Ruths storage for the condenser side |
| Steam mass | kg | Mass of steam to be stored per batch |
| Evaporator duty per batch | kWh | Energy extracted from waste heat per batch |
| Condenser duty per batch | kWh | Energy delivered to the process per batch |
