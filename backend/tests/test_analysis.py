from app.models.analysis import PinchStream, PinchRequest
from pydantic import ValidationError
import pytest

def test_pinch_stream_valid():
    stream = PinchStream(name="Hot Stream 1", CP=10.0, T_supply=100.0, T_target=50.0)
    assert stream.name == "Hot Stream 1"
    assert stream.CP == 10.0
    assert stream.T_supply == 100.0
    assert stream.T_target == 50.0

def test_pinch_stream_invalid_types():
    with pytest.raises(ValidationError):
        # CP must be float (or castable to float)
        PinchStream(name="Invalid", CP="not_a_number", T_supply=100.0, T_target=50.0)

def test_pinch_request_valid():
    req = PinchRequest(
        streams=[
            PinchStream(name="Hot", CP=5.0, T_supply=120.0, T_target=40.0),
            PinchStream(name="Cold", CP=3.0, T_supply=20.0, T_target=100.0)
        ],
        T_min=10.0
    )
    assert len(req.streams) == 2
    assert req.T_min == 10.0


def test_composite_profile_shifting(tmp_path):
    import csv
    from app.modules.pinch_main import PinchMain
    from app.modules.utility.heat_profiles import build_heat_profiles

    csv_file = tmp_path / "test_streams.csv"
    with open(csv_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Tmin", 10.0])
        writer.writerow(["CP", "TSUPPLY", "TTARGET"])
        writer.writerow([10.0, 100.0, 40.0]) # Hot stream: ts=100, tt=40 -> shifted: 95, 35
        writer.writerow([5.0, 20.0, 80.0])   # Cold stream: ts=20, tt=80 -> shifted: 25, 85

    pm = PinchMain(str(csv_file))
    pm.solve_pinch_for_hpi()

    source_profile, sink_profile = build_heat_profiles(pm.pinch_analyse, "composite")

    # Hot stream shifted bounds should be 95.0 and 35.0 (100 - 5, 40 - 5)
    assert max(source_profile["T"]) == 95.0
    assert min(source_profile["T"]) == 35.0

    # Cold stream shifted bounds should be 85.0 and 25.0 (80 + 5, 20 + 5)
    assert max(sink_profile["T"]) == 85.0
    assert min(sink_profile["T"]) == 25.0

