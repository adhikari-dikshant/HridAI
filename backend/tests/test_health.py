import pytest


@pytest.mark.parametrize("path", ["/healthz", "/health"])
def test_health_reports_mock_status(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_version": "mock-0.0", "mock": True}
