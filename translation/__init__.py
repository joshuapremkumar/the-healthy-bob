"""Language registry and mock two-way translation."""

from translation.languages import LANGUAGES, language_label
from translation.translator import MockTranslator, Translator, translate

__all__ = [
    "LANGUAGES",
    "language_label",
    "Translator",
    "MockTranslator",
    "translate",
]
