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
