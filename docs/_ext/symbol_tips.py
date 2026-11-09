"""Hover tips on formula symbols: hovering a symbol shows what it means.

At build time every known symbol inside $…$ and $$…$$ is wrapped in MathJax's
\\texttip{symbol}{meaning} (autoloaded by MathJax, no config needed). The
Markdown stays as it is. A page gets tips by having an entry in TIPS; a symbol
is matched as written in the formulas, longest first, and a single letter only
where it stands alone (so the i in \\min is left alone).
"""

import re

# Tip texts are plain text: no %, _, braces or backslashes (TeX would read them).
TIPS = {
    "economic_analysis": {
        r"\dot{Q}_{ref}": "Reference heat demand: the largest demand any candidate pump covers [kW]",
        r"\dot{Q}_{src,ref}": "Source heat the reference cools today: the largest of the candidates [kW]",
        r"\dot{Q}_{demand,total,p}": "Total heat demand seen by pump p [kW]",
        r"\dot{Q}_{source,p}": "Source heat taken up by pump p [kW]",
        r"\dot{Q}_{src}": "Source heat the heat pump takes up (its evaporator) [kW]",
        r"\dot{Q}": "Heat output of the heat pump [kW]",
        r"t_0": "First year of operation = year 0 (investment paid)",
        r"h": "Full-load hours [h/a], default 6.000",
        r"i": "Discount rate, default 8 percent",
        r"T": "Period of analysis [a], default 20",
        r"\eta": "Efficiency of the reference heater on Hs, default 87 percent (gas)",
        r"H_s/H_i": "Ratio of gross to net calorific value, 1,11 for natural gas",
        r"H_s": "Gross calorific value (fuel billed on it)",
        r"H_i": "Net calorific value (CO2 factor refers to it)",
        r"p_{fuel,0}": "Fuel price today, excl. CO2, per kWh Hs [ct/kWh], default 6",
        r"p_{fuel}": "Fuel price in year t incl. CO2 cost [EUR/kWh]",
        r"r_{fuel}": "Yearly fuel price change, default 3 percent",
        r"c_{CO_2e,el}": "CO2-equivalent factor of electricity incl. upstream chain, 0,56 t/MWh (GEG 2024)",
        r"c_{CO_2,el}": "CO2 factor of electricity, 0,352 t/MWh",
        r"c_{CO_2e}": "CO2-equivalent factor of the fuel incl. upstream chain, on Hi (gas 0,24 t/MWh)",
        r"c_{CO_2}": "CO2 factor of the fuel on Hi (gas 0,201 t/MWh)",
        r"p_{CO_2,0}": "CO2 price today, default 55 EUR/t",
        r"r_{CO_2}": "Yearly CO2 price change, default 0",
        r"CO_2": "CO2 emissions per year [t/a]",
        r"p_{el,0}": "Electricity price today [ct/kWh], default 13",
        r"p_{el}^*": "Break-even electricity price: NPV = 0, below it the heat pump wins",
        r"p_{el}": "Electricity price in year t [EUR/kWh]",
        r"r_{el}": "Yearly electricity price change, default 3 percent",
        r"p_C": "Capacity charge [EUR per kW el and year], default off",
        r"P_{el}": "Electrical power of the heat pump = heat output / COP [kW]",
        r"c_{spec}": "Heat pump price per kW, machine only, default 1.000 EUR/kW",
        r"F_{PI}": "Planning and installation factor, 1,25 (VDI 4646:2026)",
        r"F_{Per}": "Integration factor (periphery), default 1,35",
        r"f_M": "Maintenance per year as share of the investment, 2,5 percent",
        r"t_{AB}": "Operation effort [h/a], default 5",
        r"w": "Hourly rate for operation, default 100 EUR/h",
        r"L": "Service life of the heat pump, 20 a",
        r"r_{inv}": "Yearly price change of the investment, default 0",
        r"\varphi": "Investment funding as share of the investment, default 0",
        r"f_{op}": "Operating funding per MWh of heat, default off",
        r"t_{op}": "Years the operating funding is paid, default 10",
        r"EER": "Cooling COP of today's cooling, default 4",
        r"c_{boiler}": "Avoided boiler investment per kW of heat pump (replacement case), 200 EUR/kW when on",
        r"f_{k,ref}": "Maintenance of the avoided boiler, 3 percent per year",
        r"I_{ref}": "Avoided boiler investment = boiler price per kW x heat output (0 in the efficiency case)",
        r"I": "Investment of the heat pump = price per kW x planning factor x integration factor x heat output [EUR]",
        r"E_{fuel}": "Fuel used per year, on Hs [kWh/a]",
        r"E_{el}": "Electricity of the heat pump per year [kWh/a]",
        r"E_{cool}": "Electricity of the remaining cooling per year [kWh/a]",
        r"\Delta E": "Final energy saving per year [kWh/a]",
        r"COP": "Coefficient of performance of the heat pump",
        r"K_{ref}": "Operating costs of the reference in year t [EUR]",
        r"K_{HP}": "Operating costs with the heat pump in year t [EUR]",
        r"K": "Operating costs in year t [EUR]",
        r"F_{op}": "Operating funding received in year t [EUR]",
        r"CF": "Cash flow in year t: what the heat pump saves [EUR]",
        r"NPV": "Net present value (Kapitalwert) [EUR]",
        r"RV": "Residual value after T years [EUR]",
        r"R_L": "Replacement purchases at the end of each service life [EUR]",
        r"R": "Replacements and reinvestment in year t [EUR]",
        r"t_P": "Dynamic payback [a], one decimal",
        r"PP": "Static payback [a]",
        r"S": "Cost saving in year 1 [EUR]",
        r"LCOH_{HP}": "Heat cost of the heat pump [EUR/kWh heat]",
        r"LCOH_{ref}": "Heat cost of the reference heater [EUR/kWh heat]",
        r"\alpha": "Allocation factor (Finnish method): share of the electricity charged to heat",
        r"COP_\alpha": "Allocated COP = COP / alpha",
    },
}

_MATH = re.compile(r"\$\$(.+?)\$\$|(?<![\$\\])\$(?!\$)(.+?)(?<![\$\\])\$", re.S)


def _tipper(tips: dict):
    keys = sorted(tips, key=len, reverse=True)
    sym = re.compile(r"(?<![A-Za-z\\])(?:" + "|".join(map(re.escape, keys)) + r")(?![A-Za-z])")

    def math(m: re.Match) -> str:
        display = m.group(1) is not None
        body = sym.sub(lambda s: rf"\texttip{{{s.group(0)}}}{{{tips[s.group(0)]}}}", m.group(1) if display else m.group(2))
        return f"$${body}$$" if display else f"${body}$"

    return lambda text: _MATH.sub(math, text)


def _source_read(app, docname, source):
    if docname in TIPS:
        source[0] = _tipper(TIPS[docname])(source[0])


# MathJax waits 600 ms before showing a tooltip; read at hover time, so it can
# be lowered once MathJax has loaded (same path in MathJax 3 and 4).
_FAST_TIPS = """window.addEventListener('load', () => {
  const tip = window.MathJax?._?.output?.common?.Wrappers?.maction?.TooltipData;
  if (tip) tip.postDelay = 80;
});"""


def setup(app):
    app.connect("source-read", _source_read)
    app.add_js_file(None, body=_FAST_TIPS)
    return {"parallel_read_safe": True}
