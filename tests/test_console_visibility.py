import web_interface


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
