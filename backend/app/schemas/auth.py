from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

    expires_in: int = Field(
        examples=[3600]
    )


class AdminProfileResponse(BaseModel):
    username: str
    role: str