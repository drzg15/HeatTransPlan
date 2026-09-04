# -- Project information -------------------------------------------------------
project = "HeatTransPlan"
copyright = "2024, HeatTransPlan Contributors"
author = "HeatTransPlan Contributors"

# -- General configuration -----------------------------------------------------
extensions = [
    "myst_parser",
    "sphinx_togglebutton",
    "sphinx_copybutton",
    "sphinxcontrib.mermaid",
]

# MyST options
myst_enable_extensions = [
    "dollarmath",       # inline $...$ and display $$...$$ LaTeX
    "colon_fence",      # ::: directives
    "deflist",          # definition lists
]
myst_fence_as_directive = ["mermaid"]


# Source file suffixes
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

# -- HTML output ---------------------------------------------------------------
html_theme = "sphinx_book_theme"
html_title = "HeatTransPlan — Calculation Logic"
html_theme_options = {
    "repository_url": "https://github.com/drzg15/HeatTransPlan",
    "use_repository_button": True,
    "show_toc_level": 2,
    "navigation_with_keys": True,
}
html_static_path = ["_static"]
html_css_files = ["custom.css"]

# Toggle-button defaults: collapsed by default, show "▶ Show code" hint
togglebutton_hint = "Show implementation"
togglebutton_hint_hide = "Hide implementation"

# Code copy button — skip the prompt character
copybutton_prompt_text = r">>> |\.\.\. "
copybutton_prompt_is_regexp = True

# Don't complain about missing includes from backend source
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
