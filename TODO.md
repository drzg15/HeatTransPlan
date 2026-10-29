# To do

Open work, most important first.

## 1. Streams that do not run at the same time

The pinch analysis assumes every selected stream runs simultaneously. In batch
plants that is often false: a cooler and a heater can be hours apart, so the
recoverable heat and the heat pump size come out too optimistic.

- Operating hours are already collected per subprocess but not used.
- Split the day into time slices, run the pinch per slice, and offer heat
  storage between them.
- Needs a short plan before code: data model for schedules, how the charts and
  the report show several slices.

## 2. Say why no real heat pump fits

When only the theoretical references (Carnot, archetypes) are feasible, the
optimization shows them without a reason. The diagnostics already count the
rejections (sink too hot, lift too large, no source heat).

- Turn the counts into one sentence: what rules the real machines out.
- Add what would change it: a lower supply temperature, two stages, steam.

## 3. Carnot reference COP

The Carnot reference is calculated with the source fixed at the pinch
(pinch − ΔTmin/2), while the chart draws it at the point's own source
temperature. At those drawn temperatures the shown COP can exceed what physics
allows (above 100 % Carnot).

- Decide: calculate from the drawn source temperature, or draw the source at
  the pinch and say so.
- `backend/app/services/optimization/alternatives.py` (`_pin_carnot`).

## 4. Which streams to connect

The app gives targets (minimum heating and cooling, the pinch) but not which
hot stream should heat which cold one.

- A list of suggested matches with heat exchanger duties (pinch design rules
  above and below the pinch) would make the result actionable.
