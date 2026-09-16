from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_tts_mode_toggles_persist_and_runtime_reads_legacy_mode():
    engine_settings = (ROOT / "services" / "static" / "js" / "dashboard" / "modules" / "engine_settings.js").read_text(encoding="utf-8")
    pet_core = (ROOT / "services" / "static" / "js" / "pet" / "pet_core.js").read_text(encoding="utf-8")

    assert "getElementById('tts-mode-click-toggle')" in engine_settings
    assert "enable_tts_click: ttsClickToggle.checked" in engine_settings
    assert "getElementById('tts-mode-auto-toggle')" in engine_settings
    assert "enable_tts_auto: enabled" in engine_settings
    assert "tts_speak_mode: enabled ? 'auto' : 'click'" in engine_settings
    assert 'this.ttsSpeakMode = data.tts_speak_mode || (this.enableTtsAuto ? "auto" : "click");' in pet_core
