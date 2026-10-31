from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import ApiError, send_error

MAX_RECORDING_BYTES = 5 * 1024 * 1024
_MULTIPART_OVERHEAD_BYTES = 64 * 1024
_MAX_BODY_BYTES = MAX_RECORDING_BYTES + _MULTIPART_OVERHEAD_BYTES


class UploadLimitMiddleware:
    """Stops oversized uploads before Starlette spools them, since /tmp uses instance memory."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].endswith("/recordings"):
            await self.app(scope, receive, send)
            return

        declared = Headers(scope=scope).get("content-length", "")
        if declared.isdigit() and int(declared) > _MAX_BODY_BYTES:
            await send_error(send, "file_too_large")
            return

        received = 0

        async def counted_receive() -> Message:
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > _MAX_BODY_BYTES:
                raise ApiError("file_too_large")
            return message

        await self.app(scope, counted_receive, send)
