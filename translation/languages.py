"""Supported languages and display metadata."""

LANGUAGES: dict[str, dict[str, str]] = {
    "en": {"name": "English", "native": "English", "flag": "🇬🇧", "accent": "#4CC9F0", "direction": "ltr"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "flag": "🇮🇳", "accent": "#F72585", "direction": "ltr"},
    "hi": {"name": "Hindi", "native": "हिन्दी", "flag": "🇮🇳", "accent": "#FFB703", "direction": "ltr"},
    "es": {"name": "Spanish", "native": "Español", "flag": "🇪🇸", "accent": "#FB8500", "direction": "ltr"},
    "fr": {"name": "French", "native": "Français", "flag": "🇫🇷", "accent": "#7B2CBF", "direction": "ltr"},
    "ar": {"name": "Arabic", "native": "العربية", "flag": "🇸🇦", "accent": "#06D6A0", "direction": "rtl"},
}


def language_label(code: str) -> str:
    """Return a compact emoji label for a language code."""
    info = LANGUAGES.get(code)
    if not info:
        return f"🏳️ {code}"
    return f"{info['flag']} {info['native']} ({info['name']})"


def is_rtl(code: str) -> bool:
    """Whether the language is right-to-left."""
    return LANGUAGES.get(code, {}).get("direction") == "rtl"


__all__ = ["LANGUAGES", "language_label", "is_rtl"]
