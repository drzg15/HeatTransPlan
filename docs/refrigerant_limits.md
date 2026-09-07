# Refrigerant Operating Limits

The following table lists the operating temperature ranges and COP bounds for all refrigerant alternatives defined in `models/cop/cop_ranges.json`. These limits are used by the Heat Pump Optimization engine to filter feasible candidates.

| Name | Stage | Medium Sink | Refrigerant Type | HP Level | $T_{src\,min}$ (°C) | $T_{src\,max}$ (°C) | $T_{sink\,min}$ (°C) | $T_{sink\,max}$ (°C) | $COP_{min}$ | $COP_{max}$ |
|---|---|---|---|---|---|---|---|---|---|---|
| Butane_1 | 1 | Steam | Natural | 1 | 40.0 | 85.0 | 105.0 | 135.0 | 2.615 | 4.806 |
| Butane_1 | 1 | Water | Natural | 1 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.439 |
| Butane_2 | 2 | Steam | Natural | 2 | 40.0 | 85.0 | 105.0 | 135.0 | 2.664 | 4.938 |
| Butane_2 | 2 | Water | Natural | 2 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.915 |
| Butane_3 | 3 | Steam | Natural | 3 | 40.0 | 85.0 | 105.0 | 135.0 | 2.678 | 4.975 |
| Butane_3 | 3 | Water | Natural | 3 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.439 |
| Isobutane_1 | 1 | Steam | Natural | 1 | 40.0 | 75.0 | 105.0 | 115.0 | 2.672 | 4.203 |
| Isobutane_1 | 1 | Water | Natural | 1 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isobutane_2 | 2 | Steam | Natural | 2 | 40.0 | 75.0 | 105.0 | 115.0 | 2.759 | 4.203 |
| Isobutane_2 | 2 | Water | Natural | 2 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isobutane_3 | 3 | Steam | Natural | 3 | 40.0 | 75.0 | 105.0 | 115.0 | 2.789 | 4.203 |
| Isobutane_3 | 3 | Water | Natural | 3 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isopentane_1 | 1 | Steam | Natural | 1 | 50.0 | 85.0 | 105.0 | 165.0 | 2.776 | 5.027 |
| Isopentane_1 | 1 | Water | Natural | 1 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 8.492 |
| Isopentane_2 | 2 | Steam | Natural | 2 | 50.0 | 85.0 | 105.0 | 165.0 | 2.831 | 5.179 |
| Isopentane_2 | 2 | Water | Natural | 2 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 9.255 |
| Isopentane_3 | 3 | Steam | Natural | 3 | 50.0 | 85.0 | 105.0 | 165.0 | 2.846 | 5.222 |
| Isopentane_3 | 3 | Water | Natural | 3 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 8.492 |
| Propane_1 | 1 | Water | Natural | 1 | 20.0 | 40.0 | 80.0 | 80.0 | 3.335 | 3.660 |
| Propane_2 | 2 | Water | Natural | 2 | 20.0 | 40.0 | 80.0 | 80.0 | 3.372 | 3.660 |
| Propane_3 | 3 | Water | Natural | 3 | 20.0 | 40.0 | 80.0 | 80.0 | 3.335 | 3.660 |
| R1224yd_1 | 1 | Steam | Synthetic | 1 | 50.0 | 85.0 | 105.0 | 145.0 | 2.762 | 4.865 |
| R1224yd_1 | 1 | Water | Synthetic | 1 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 8.731 |
| R1224yd_2 | 2 | Steam | Synthetic | 2 | 55.0 | 85.0 | 105.0 | 145.0 | 3.002 | 4.962 |
| R1224yd_2 | 2 | Water | Synthetic | 2 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 9.584 |
| R1224yd_3 | 3 | Steam | Synthetic | 3 | 50.0 | 85.0 | 105.0 | 145.0 | 2.884 | 4.995 |
| R1224yd_3 | 3 | Water | Synthetic | 3 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 8.731 |
| R1233zd_1 | 1 | Steam | Synthetic | 1 | 50.0 | 85.0 | 105.0 | 145.0 | 2.820 | 4.906 |
| R1233zd_1 | 1 | Water | Synthetic | 1 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 8.769 |
| R1233zd_2 | 2 | Steam | Synthetic | 2 | 50.0 | 85.0 | 105.0 | 145.0 | 2.915 | 5.061 |
| R1233zd_2 | 2 | Water | Synthetic | 2 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 9.594 |
| R1233zd_3 | 3 | Steam | Synthetic | 3 | 50.0 | 85.0 | 105.0 | 145.0 | 2.948 | 5.102 |
| R1233zd_3 | 3 | Water | Synthetic | 3 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 8.769 |
| R1234ZEE_1 | 1 | Water | Synthetic | 1 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1234ZEE_2 | 2 | Water | Synthetic | 2 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1234ZEE_3 | 3 | Water | Synthetic | 3 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1336mzzZ_1 | 1 | Steam | Synthetic | 1 | 60.0 | 85.0 | 105.0 | 155.0 | 3.011 | 4.849 |
| R1336mzzZ_1 | 1 | Water | Synthetic | 1 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 8.876 |
| R1336mzzZ_2 | 2 | Steam | Synthetic | 2 | 60.0 | 85.0 | 105.0 | 155.0 | 3.077 | 5.010 |
| R1336mzzZ_2 | 2 | Water | Synthetic | 2 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 9.574 |
| R1336mzzZ_3 | 3 | Steam | Synthetic | 3 | 60.0 | 85.0 | 105.0 | 155.0 | 3.096 | 5.057 |
| R1336mzzZ_3 | 3 | Water | Synthetic | 3 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 8.876 |

*All temperatures are in degrees °C. COP bounds are dimensionless.*
