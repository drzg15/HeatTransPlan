"""Safe evaluation of a user-supplied COP formula.

The optimisation panel lets anyone paste an expression for COP. That text
arrives over a public endpoint, so it is never handed to eval() as written:
it is parsed to an AST and every node is checked against a whitelist before
anything runs. Attribute access, subscripting, lambdas, comprehensions and
calls to anything outside ALLOWED_FUNCS are rejected at parse time, so the
usual escapes (``__import__``, ``().__class__.__bases__``) never execute.

The shape mirrors HP_COP_CORRELATIONS in heat_pump_integration.py, which
already expresses COP as a function of sink temperature and lift — a pasted
formula is the same idea supplied at runtime.
"""
from __future__ import annotations

import ast
import math
from typing import Callable, Dict, Iterable, Mapping

import numpy as np

# An expression long enough to matter is a mistake, not a heat pump model.
MAX_FORMULA_LENGTH = 500

# Ceiling on a literal exponent. See _check_pow for why the exponent must be a
# literal at all.
MAX_EXPONENT = 64

# Elementwise numpy equivalents, so a formula evaluates over the whole
# temperature mesh in one call rather than per grid point.
ALLOWED_FUNCS: Dict[str, Callable] = {
    "exp": np.exp,
    "log": np.log,
    "log10": np.log10,
    "sqrt": np.sqrt,
    "sin": np.sin,
    "cos": np.cos,
    "tan": np.tan,
    "abs": np.abs,
    "min": np.minimum,
    "max": np.maximum,
    "clip": np.clip,
    "where": np.where,
}

ALLOWED_CONSTANTS: Dict[str, float] = {"pi": math.pi, "e": math.e}

#: Variables a formula may reference, with the description shown in the UI.
FORMULA_VARIABLES: Dict[str, str] = {
    "T_source": "Source (evaporator) temperature in °C",
    "T_sink": "Sink (condenser) temperature in °C",
    "T_lift": "Temperature lift, T_sink - T_source, in K",
    "carnot": "Carnot COP, T_sink in K divided by T_lift",
}

#: Still evaluated and still accepted by the parser, but no longer offered in
#: the UI. Temperatures are quoted in °C throughout the rest of the app, so two
#: extra names for the same two temperatures were more confusing than helpful —
#: a formula that wants Kelvin converts inline, the way both built-in examples
#: do with ``T_sink + 273``. Keeping the names working means a formula saved
#: before they were hidden does not suddenly fail to validate.
HIDDEN_VARIABLES: Dict[str, str] = {
    "T_source_K": "Source temperature in K",
    "T_sink_K": "Sink temperature in K",
}

_ALLOWED_NODES = (
    ast.Expression,
    ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name, ast.Call,
    ast.Load, ast.Compare, ast.IfExp, ast.BoolOp,
    # operators
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod,
    ast.USub, ast.UAdd,
    ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq,
    ast.And, ast.Or,
)


class FormulaError(ValueError):
    """The formula is malformed, or uses something that is not permitted."""


def _literal_number(node: ast.AST):
    """Return the value of a numeric literal, allowing a leading +/-."""
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        inner = _literal_number(node.operand)
        if inner is None:
            return None
        return -inner if isinstance(node.op, ast.USub) else inner
    return None


def _check_pow(node: ast.BinOp) -> None:
    """Reject exponents that could burn CPU before any array is involved.

    Bounding only *constant* exponents is not enough: ``9 ** 9 ** 9`` parses as
    ``9 ** (9 ** 9)``, whose exponent is a BinOp rather than a literal, and
    Python evaluates it as an integer with hundreds of millions of digits —
    a denial of service from a text field. Requiring a plain literal closes
    that off, and costs nothing: COP correlations raise to fixed powers.
    """
    exponent = _literal_number(node.right)
    if exponent is None:
        raise FormulaError(
            "The exponent after '**' has to be a plain number, "
            "for example T_lift ** -0.89."
        )
    if abs(exponent) > MAX_EXPONENT:
        raise FormulaError(f"Exponents are limited to ±{MAX_EXPONENT}.")


def compile_formula(expression: str, variables: Iterable[str] = None):
    """Validate `expression` and return a compiled code object.

    Raises FormulaError with a message meant for the person who typed it.
    """
    if expression is None or not expression.strip():
        raise FormulaError("The formula is empty.")
    if len(expression) > MAX_FORMULA_LENGTH:
        raise FormulaError(
            f"The formula is longer than {MAX_FORMULA_LENGTH} characters."
        )

    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise FormulaError(f"Syntax error: {exc.msg}.") from exc

    # Suggested in error messages; the hidden names resolve but are not
    # advertised, so nobody starts writing new formulas against them.
    suggested_names = set(variables if variables is not None else FORMULA_VARIABLES)
    allowed_names = suggested_names | set(HIDDEN_VARIABLES) | set(ALLOWED_CONSTANTS)

    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise FormulaError(
                f"'{type(node).__name__}' is not allowed. The formula may only "
                "combine the listed variables with arithmetic and the allowed "
                "functions."
            )

        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
            raise FormulaError("Only numbers may be used as literal values.")

        if isinstance(node, ast.Name):
            if node.id not in allowed_names and node.id not in ALLOWED_FUNCS:
                raise FormulaError(
                    f"Unknown name '{node.id}'. Available variables: "
                    + ", ".join(sorted(suggested_names))
                    + "."
                )

        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in ALLOWED_FUNCS:
                raise FormulaError(
                    "Allowed functions are: " + ", ".join(sorted(ALLOWED_FUNCS)) + "."
                )
            if node.keywords:
                raise FormulaError("Functions do not take keyword arguments here.")

        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
            _check_pow(node)

    return compile(tree, "<cop-formula>", "eval")


def build_variables(t_source, t_sink) -> Dict[str, np.ndarray]:
    """Derive the variable set a formula may reference from the temperatures."""
    src = np.asarray(t_source, dtype=float)
    snk = np.asarray(t_sink, dtype=float)
    lift = snk - src
    src_k = src + 273.15
    snk_k = snk + 273.15

    # A non-positive lift is not a heat pump duty. Rather than dividing by zero
    # here, hand back NaN so the caller's feasibility filter drops the point.
    with np.errstate(divide="ignore", invalid="ignore"):
        carnot = np.where(lift > 0.0, snk_k / np.where(lift > 0.0, lift, np.nan), np.nan)

    return {
        "T_source": src,
        "T_sink": snk,
        "T_source_K": src_k,
        "T_sink_K": snk_k,
        "T_lift": lift,
        "carnot": carnot,
    }


def evaluate_formula(code, variables: Mapping[str, np.ndarray]) -> np.ndarray:
    """Evaluate a compiled formula over the given variables.

    The globals carry no ``__builtins__``, so even if a node slipped past the
    whitelist there is nothing reachable to call.
    """
    env: Dict[str, object] = {"__builtins__": {}}
    env.update(ALLOWED_CONSTANTS)
    env.update(ALLOWED_FUNCS)
    env.update(variables)

    try:
        with np.errstate(divide="ignore", invalid="ignore", over="ignore"):
            result = eval(code, env)  # noqa: S307 - AST whitelisted, no builtins
    except FormulaError:
        raise
    except Exception as exc:
        raise FormulaError(f"The formula could not be evaluated: {exc}") from exc

    array = np.asarray(result, dtype=float)

    # A formula that ignores its inputs (e.g. "4.5") returns a scalar; broadcast
    # it so callers always get one COP per grid point.
    reference = next(iter(variables.values()))
    if array.shape != np.shape(reference):
        array = np.broadcast_to(array, np.shape(reference)).astype(float, copy=True)

    return array


def cop_from_formula(expression: str, t_source, t_sink) -> np.ndarray:
    """Compile and evaluate in one step. For one-off checks, not hot loops."""
    code = compile_formula(expression)
    return evaluate_formula(code, build_variables(t_source, t_sink))
