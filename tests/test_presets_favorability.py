import json

import tools.presets_manager as presets_manager


def _write_preset_files(tmp_path, global_presets, custom_presets=None):
    custom_file = tmp_path / "custom_presets.json"
    custom_file.write_text(json.dumps(custom_presets or [], ensure_ascii=False), encoding="utf-8")

    global_dir = tmp_path / "global_presets"
    global_dir.mkdir()
    (global_dir / "global_presets.json").write_text(
        json.dumps(global_presets, ensure_ascii=False), encoding="utf-8"
    )
    return custom_file


def test_favorability_range_boundaries_are_inclusive():
    preset = {"min_favorability": 31, "max_favorability": 59}

    assert not presets_manager.is_favorability_allowed(preset, 30)
    assert presets_manager.is_favorability_allowed(preset, 31)
    assert presets_manager.is_favorability_allowed(preset, 59)
    assert not presets_manager.is_favorability_allowed(preset, 60)


def test_load_and_trigger_presets_restores_common_and_recursive_ranges(monkeypatch, tmp_path):
    global_presets = [
        {
            "name": "common_low",
            "always_active": True,
            "min_favorability": 0,
            "max_favorability": 30,
            "prompt": "low",
        },
        {
            "name": "common_mid",
            "trigger_keywords": ["关键词"],
            "min_favorability": 31,
            "max_favorability": 59,
            "prompt": "mid",
        },
        {
            "name": "common_high",
            "trigger_keywords": ["关键词"],
            "min_favorability": 60,
            "prompt": "high",
        },
        {
            "name": "recursive_source",
            "trigger_keywords": ["根词"],
            "prompt": "链式词",
        },
        {
            "name": "recursive_locked",
            "trigger_keywords": ["链式词"],
            "min_favorability": 90,
            "prompt": "locked",
        },
    ]
    custom_file = _write_preset_files(tmp_path, global_presets)

    monkeypatch.setattr(presets_manager, "get_custom_presets_file", lambda: str(custom_file))
    monkeypatch.setattr(presets_manager, "USER_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(presets_manager, "SERVICES_DIR", str(tmp_path / "services"))
    monkeypatch.setattr(presets_manager, "get_config", lambda: {"preset_max_depth": 2})

    triggered = presets_manager.load_and_trigger_presets("关键词 根词", favorability=40)
    names = {preset["name"] for preset in triggered}

    assert names == {"common_mid", "recursive_source"}


def test_malformed_favorability_range_does_not_break_preset_loading():
    assert presets_manager.is_favorability_allowed(
        {"min_favorability": "not-a-number"}, 50
    )
    assert not presets_manager.is_favorability_allowed(
        {"min_favorability": "not-a-number", "max_favorability": 40}, 50
    )
