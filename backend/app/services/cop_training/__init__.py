"""COP training: fit a neural network to the user's own heat pump data and
use it in the optimization next to the shipped model.

A module that can be switched off: COP_TRAINING_ENABLED=0 removes its
endpoints, hides it on the page (GET /api/features) and makes the
optimization ignore trained models.
"""

import os

ENABLED = os.getenv("COP_TRAINING_ENABLED", "1").lower() not in ("0", "false", "off", "no")
