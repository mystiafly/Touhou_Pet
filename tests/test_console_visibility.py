import web_interface
from run import configure_headless_output, get_process_creationflags, should_hide_console


def test_apply_startup_console_visibility_hides_console(monkeypatch):
    calls = []

    monkeypatch.setattr(web_interface, "get_config", lambda: {"hide_console": True})
    monkeypatch.setattr(web_interface, "set_console_visible", calls.append)

    web_interface.apply_startup_console_visibility()

    assert calls == [False]


def test_apply_startup_console_visibility_shows_console_when_disabled(monkeypatch):
    calls = []

    monkeypatch.setattr(web_interface, "get_config", lambda: {"hide_console": False})
    monkeypatch.setattr(web_interface, "set_console_visible", calls.append)

    web_interface.apply_startup_console_visibility()

    assert calls == [True]


def test_should_hide_console_reads_persisted_setting(tmp_path):
    services_dir = tmp_path / "services"
    services_dir.mkdir()
    (services_dir / "global_config.json").write_text('{"hide_console": true}', encoding="utf-8")

    assert should_hide_console(str(tmp_path)) is True


def test_hidden_process_uses_no_console_flag():
    assert get_process_creationflags(True) != 0


def test_configure_headless_output_is_noop_with_normal_stdout(tmp_path):
    assert configure_headless_output(str(tmp_path), True) is None
