# Step 1 — Data Collection

Step 1 records the plant: where its areas are, what happens in them, and which streams are cooled (waste heat) and heated (demand). Nothing is calculated here; Steps 2–4 use these data.

| What | How it is entered |
|---|---|
| **Process** | A plant area, placed on the map ("+ Add process", then "Place"). |
| **Subprocess** | A machine or step inside a process ("+ Add" in the open process). |
| **Connection** | "Next processes" draws an arrow between processes: the flow of product from one to the next. |
| **Stream** | Per subprocess, in the stream table: inlet and outlet temperature $T_{in}$, $T_{out}$ [°C], mass flow $\dot{m}$ and specific heat capacity $c_p$, or the duty directly, plus the operating hours. |

From mass flow and heat capacity the app forms the **heat capacity flow rate** $\dot{C}_P = \dot{m} \cdot c_p$ [kW/K], the one number per stream the pinch analysis needs (see *Step 2*, *Input: Process Streams*). A stream with $T_{in} > T_{out}$ is cooled (hot stream), one with $T_{in} < T_{out}$ is heated (cold stream).

The map is a real map, not a flowsheet: a match that is thermodynamically ideal may sit half a kilometre away. The stream table exports the distances between streams (Manhattan and Euclidean), so a promising match can be checked against what it would cost to connect.

The data stay in the browser and are saved only when a project file is saved.
