"""Pydantic model validation template — happy paths, validation errors, serialization."""
from __future__ import annotations

import pytest

try:
    from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
except ImportError:  # pragma: no cover
    pytest.skip("pydantic not installed", allow_module_level=True)


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=50)
    age: int = Field(ge=13, le=120)
    tags: list[str] = []

    @field_validator("name")
    @classmethod
    def name_no_digits(cls, v: str) -> str:
        if any(ch.isdigit() for ch in v):
            raise ValueError("name must not contain digits")
        return v


class TestUserCreateValid:
    def test_minimal_payload(self):
        u = UserCreate(email="a@b.com", name="Al", age=18)
        assert u.email == "a@b.com"
        assert u.tags == []

    def test_round_trip_dict(self):
        u = UserCreate(email="a@b.com", name="Alice", age=30, tags=["x", "y"])
        d = u.model_dump()
        assert UserCreate(**d) == u

    def test_round_trip_json(self):
        u = UserCreate(email="a@b.com", name="Alice", age=30)
        j = u.model_dump_json()
        assert UserCreate.model_validate_json(j) == u


class TestUserCreateInvalid:
    @pytest.mark.parametrize(
        "field,bad,err_substr",
        [
            ("email", "not-an-email", "email"),
            ("name", "A", "at least 2"),
            ("name", "x" * 51, "at most 50"),
            ("name", "Al1ce", "must not contain digits"),
            ("age", 12, "greater than or equal to 13"),
            ("age", 200, "less than or equal to 120"),
        ],
        ids=["email", "name-short", "name-long", "name-digit", "age-low", "age-high"],
    )
    def test_validation_error(self, field, bad, err_substr):
        payload = {"email": "a@b.com", "name": "Alice", "age": 30}
        payload[field] = bad
        with pytest.raises(ValidationError) as exc:
            UserCreate(**payload)
        assert err_substr.lower() in str(exc.value).lower()

    def test_extra_fields_ignored_by_default(self):
        u = UserCreate(email="a@b.com", name="Al", age=18, extra="???")  # type: ignore[call-arg]
        assert not hasattr(u, "extra")
