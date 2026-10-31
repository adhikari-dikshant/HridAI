from fastapi import APIRouter, Request

router = APIRouter()


def _health(request: Request) -> dict:
    return {
        "status": "ok",
        "model_version": request.app.state.service.classifier.model_version,
        "mock": request.app.state.settings.mock_inference,
    }


# /healthz is the contract path, but Cloud Run advises against paths ending in z.
router.add_api_route("/healthz", _health, methods=["GET"])
router.add_api_route("/health", _health, methods=["GET"])
