import json
import logging

from fastapi.testclient import TestClient

from app.main import create_app


def assert_envelope(body: dict, code: str) -> None:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message_en", "message_hi"}
    assert body["error"]["code"] == code
    assert body["error"]["message_en"]
    assert body["error"]["message_hi"]


def test_unknown_route_uses_error_envelope(client):
    response = client.get("/nope")

    assert response.status_code == 404
    assert_envelope(response.json(), "not_found")


def test_wrong_method_uses_error_envelope(client):
    response = client.post("/healthz")

    assert response.status_code == 405
    assert_envelope(response.json(), "method_not_allowed")


def test_request_id_is_generated_when_absent(client):
    assert client.get("/healthz").headers["X-Request-ID"]


def test_safe_request_id_is_echoed(client):
    response = client.get("/healthz", headers={"X-Request-ID": "abc-123"})

    assert response.headers["X-Request-ID"] == "abc-123"


def test_unsafe_request_id_is_replaced(client):
    response = client.get("/healthz", headers={"X-Request-ID": "bad id\twith junk"})

    assert response.headers["X-Request-ID"] != "bad id\twith junk"


def test_unhandled_error_returns_500_envelope_with_request_id(settings):
    app = create_app(settings)

    @app.get("/boom")
    def boom():
        raise RuntimeError("secret patient detail")

    with TestClient(app) as test_client:
        response = test_client.get("/boom", headers={"X-Request-ID": "req-1"})

    assert response.status_code == 500
    assert_envelope(response.json(), "internal_error")
    assert response.headers["X-Request-ID"] == "req-1"
    assert "secret" not in response.text


def test_logs_are_json_with_request_id(client, caplog):
    from app.core.logging import JsonFormatter

    with caplog.at_level(logging.INFO, logger="app.request"):
        client.get("/healthz", headers={"X-Request-ID": "req-2"})

    line = json.loads(JsonFormatter().format(caplog.records[-1]))
    assert line["severity"] == "INFO"
    assert line["request_id"] == "req-2"
    assert line["path"] == "/healthz"
    assert line["status"] == 200
