"""Generate a real Argon2id hash for the default admin password 'admin123'.

The Rust `argon2 = "0.5"` crate's `Argon2::default()` uses these params:
- m_cost: 19456 (19 MiB)
- t_cost: 2
- p_cost: 1
- output_len: 32 bytes
- type: Argon2id

We use the same params here so the generated PHC string is verifiable by
the Rust crate via `Argon2::default().verify_password(...)`.
"""
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

hash_str = ph.hash("admin123")

print("=" * 70)
print("Generated Argon2id hash for 'admin123'")
print("=" * 70)
print()
print("HASH:")
print(hash_str)
print()
print("Length:", len(hash_str))

# Sanity check: verify with correct and wrong password
try:
    ph.verify(hash_str, "admin123")
    print("VERIFY 'admin123' -> PASS")
except VerifyMismatchError:
    print("VERIFY 'admin123' -> FAIL")
    raise

try:
    ph.verify(hash_str, "wrongpass")
    print("VERIFY 'wrongpass' -> FAIL (should have raised)")
    raise SystemExit(1)
except VerifyMismatchError:
    print("VERIFY 'wrongpass' -> correctly rejected")

# Also confirm the params string starts with the expected prefix
expected_prefix = "$argon2id$v=19$m=19456,t=2,p=1$"
print()
print("Prefix check:", "PASS" if hash_str.startswith(expected_prefix) else "FAIL")
print("Expected prefix:", expected_prefix)
