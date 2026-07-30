import os
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
}

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
}

UPLOAD_ROOT = Path(
    os.getenv("UPLOAD_ROOT", "uploads")
)

RECEIPTS_DIRECTORY = UPLOAD_ROOT / "receipts"

CHUNK_SIZE = 1024 * 1024


def get_file_extension(filename: str | None) -> str:
    if not filename:
        raise ValueError("The uploaded file has no filename")

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Unsupported file extension. "
            "Allowed types: JPG, JPEG, PNG and PDF"
        )

    return extension


def validate_content_type(
    content_type: str | None,
) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            "Unsupported file type. "
            "Allowed types: JPG, JPEG, PNG and PDF"
        )


def validate_file_signature(
    first_bytes: bytes,
    extension: str,
) -> None:
    is_jpeg = first_bytes.startswith(b"\xff\xd8\xff")
    is_png = first_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    is_pdf = first_bytes.startswith(b"%PDF")

    if extension in {".jpg", ".jpeg"} and not is_jpeg:
        raise ValueError(
            "The uploaded file is not a valid JPEG image"
        )

    if extension == ".png" and not is_png:
        raise ValueError(
            "The uploaded file is not a valid PNG image"
        )

    if extension == ".pdf" and not is_pdf:
        raise ValueError(
            "The uploaded file is not a valid PDF document"
        )


async def save_receipt(
    file: UploadFile,
    transfer_id: int,
) -> str:
    extension = get_file_extension(file.filename)

    validate_content_type(file.content_type)

    RECEIPTS_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    random_name = uuid4().hex

    stored_filename = (
        f"transfer_{transfer_id}_{random_name}{extension}"
    )

    absolute_path = (
        RECEIPTS_DIRECTORY / stored_filename
    )

    relative_path = (
        Path("receipts") / stored_filename
    )

    total_size = 0
    first_chunk = True

    try:
        with absolute_path.open("wb") as destination:
            while True:
                chunk = await file.read(CHUNK_SIZE)

                if not chunk:
                    break

                if first_chunk:
                    validate_file_signature(
                        chunk,
                        extension,
                    )
                    first_chunk = False

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise ValueError(
                        "The receipt file must not exceed 10 MB"
                    )

                destination.write(chunk)

        if total_size == 0:
            raise ValueError(
                "The uploaded receipt file is empty"
            )

    except Exception:
        if absolute_path.exists():
            absolute_path.unlink()

        raise

    finally:
        await file.close()

    return relative_path.as_posix()


def delete_receipt(
    receipt_path: str | None,
) -> None:
    if not receipt_path:
        return

    normalized_path = Path(receipt_path)

    if normalized_path.is_absolute():
        return

    absolute_path = (
        UPLOAD_ROOT / normalized_path
    ).resolve()

    upload_root_resolved = UPLOAD_ROOT.resolve()

    try:
        absolute_path.relative_to(
            upload_root_resolved
        )
    except ValueError:
        return

    if absolute_path.exists() and absolute_path.is_file():
        absolute_path.unlink()