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


def test_tee_logger_reconfigures_terminal_stream(tmp_path):
    class ReconfigurableStream:
        def __init__(self):
            self.calls = []

        def reconfigure(self, **kwargs):
            self.calls.append(kwargs)

        def write(self, _message):
            pass

        def flush(self):
            pass

        def isatty(self):
            return True

    stream = ReconfigurableStream()
    logger = web_interface.TeeLogger(stream, str(tmp_path / "backend.log"))

    logger.reconfigure(encoding="utf-8", errors="replace")

    assert stream.calls == [{"encoding": "utf-8", "errors": "replace"}]
