import json

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Send

# code -> (HTTP status, English message, Hindi message).
# Hindi other than screening_not_found is drafted and needs native-speaker review.
ERRORS: dict[str, tuple[int, str, str]] = {
    "invalid_request": (400, "The request is not valid.", "अनुरोध सही नहीं है।"),
    "consent_required": (
        400,
        "Consent is required to continue.",
        "आगे बढ़ने के लिए सहमति ज़रूरी है।",
    ),
    "unauthorized": (401, "Please sign in again.", "कृपया दोबारा साइन इन करें।"),
    "not_found": (404, "This page does not exist.", "यह पेज मौजूद नहीं है।"),
    "screening_not_found": (404, "This screening does not exist.", "यह जाँच मौजूद नहीं है।"),
    "method_not_allowed": (405, "This action is not allowed.", "यह कार्रवाई संभव नहीं है।"),
    "no_accepted_recordings": (
        409,
        "At least one accepted recording is needed.",
        "कम से कम एक स्वीकृत रिकॉर्डिंग ज़रूरी है।",
    ),
    "analysis_in_progress": (
        409,
        "Analysis is already running. Please wait.",
        "जाँच पहले से चल रही है। कृपया प्रतीक्षा करें।",
    ),
    "file_too_large": (413, "The file is too large.", "फ़ाइल बहुत बड़ी है।"),
    "unsupported_media_type": (
        415,
        "This file type is not supported.",
        "यह फ़ाइल प्रकार समर्थित नहीं है।",
    ),
    "unsupported_audio": (415, "This audio could not be read.", "यह ऑडियो पढ़ा नहीं जा सका।"),
    "internal_error": (
        500,
        "Something went wrong. Please try again.",
        "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।",
    ),
}

_CODE_BY_STATUS = {
    400: "invalid_request",
    401: "unauthorized",
    404: "not_found",
    405: "method_not_allowed",
    413: "file_too_large",
    415: "unsupported_media_type",
}


class ApiError(StarletteHTTPException):
    def __init__(self, code: str) -> None:
        super().__init__(status_code=ERRORS[code][0], detail=code)
        self.code = code


def error_body(code: str) -> dict:
    _, message_en, message_hi = ERRORS[code]
    return {"error": {"code": code, "message_en": message_en, "message_hi": message_hi}}


async def send_error(send: Send, code: str) -> None:
    """Sends the error envelope from ASGI middleware, outside FastAPI's handlers."""
    body = json.dumps(error_body(code), ensure_ascii=False).encode()
    await send(
        {
            "type": "http.response.start",
            "status": ERRORS[code][0],
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = exc.code if isinstance(exc, ApiError) else _CODE_BY_STATUS.get(exc.status_code)
    return JSONResponse(error_body(code or "internal_error"), status_code=exc.status_code)


def _validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    # The error detail can echo patient fields, so it is neither returned nor logged.
    return JSONResponse(error_body("invalid_request"), status_code=400)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
