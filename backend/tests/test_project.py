from app.models.project import ProjectState
from pydantic import ValidationError
import pytest

def test_project_state_defaults():
    state = ProjectState()
    assert state.map_locked is False
    assert state.t_min == 10.0
    assert len(state.processes) == 0

def test_project_state_invalid_map_center():
    with pytest.raises(ValidationError):
        # map_center must be a list of floats
        ProjectState(map_center="not_a_list")
