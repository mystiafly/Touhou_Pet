from types import SimpleNamespace

import pytest

from api.routers.system import (
    _classify_git_update,
    _compare_versions,
    _get_git_update_state,
)


@pytest.mark.parametrize(
    ("local_only", "remote_only", "expected"),
    [
        (0, 0, "up_to_date"),
        (0, 3, "remote_ahead"),
        (3, 0, "local_ahead"),
        (2, 1, "diverged"),
    ],
)
def test_classify_git_update(local_only, remote_only, expected):
    assert _classify_git_update(local_only, remote_only) == expected


@pytest.mark.parametrize(
    ("current", "latest", "expected"),
    [
        ("1.52.0", "1.52.0", "up_to_date"),
        ("1.51.0", "1.52.0", "remote_ahead"),
        ("1.52.0", "1.50.11", "local_ahead"),
        ("v1.52.0", "1.52.1-beta.1", "remote_ahead"),
        ("1.52", "1.53.0", "unknown"),
    ],
)
def test_compare_versions(current, latest, expected):
    assert _compare_versions(current, latest) == expected


def test_get_git_update_state_uses_commit_topology(monkeypatch):
    def fake_run(command, **kwargs):
        assert command == ["git", "rev-list", "--left-right", "--count", "HEAD...FETCH_HEAD"]
        return SimpleNamespace(returncode=0, stdout="3\t0")

    monkeypatch.setattr("api.routers.system.subprocess.run", fake_run)

    assert _get_git_update_state("/project") == "local_ahead"


def test_get_git_update_state_handles_invalid_git_output(monkeypatch):
    monkeypatch.setattr(
        "api.routers.system.subprocess.run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="not-a-count"),
    )

    assert _get_git_update_state("/project") == "unknown"
