# Refrigerant Operating Limits

The following table lists the operating temperature ranges and COP bounds for all refrigerant alternatives in {code}`models/cop/cop_ranges.json`. These limits are used by the [Heat Pump Optimization](heat_pump_optimization.md) engine to filter feasible candidates: a grid point outside a refrigerant's source or sink range, or with a predicted COP outside its COP range, is not an operating point for that refrigerant.

The table is generated from that file each time the documentation is built, so it always shows the limits the app is actually using. The name is the refrigerant and its number of compression stages, the form the trained model takes as input.

```{include} _generated/refrigerant_limits_table.md
```

**Implementation:** loaded by {code}`backend/app/services/optimization_service.py#_load_model_and_data`; exported from the modelling data by {code}`cop_analysis/export_cop_ranges.py`
