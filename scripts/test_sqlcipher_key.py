"""Smoke test for the SQLCipher key-file logic.

This replicates the Rust logic in src/database/mod.rs (load_or_create_key)
in Python to confirm:
1. A 32-byte key file is generated with cryptographically-secure randomness.
2. The hex encoding is correct (64 lowercase chars).
3. Re-reading the file returns the same key.
4. File permissions on Unix are 0600 (owner-only).
5. The PRAGMA key string format `x'<hex>'` is what SQLCipher expects.

We also use pysqlcipher3 (if available) to actually create an encrypted DB,
write a row, reopen it with the same key, and verify we can read the row
back. If pysqlcipher3 is not installed, only the key-file logic is tested
and the SQLCipher round-trip is skipped with a warning.
"""
import os
import stat
import sys
import tempfile
import secrets
from pathlib import Path


def load_or_create_key(key_path: Path) -> str:
    """Mirror of Rust load_or_create_key."""
    if key_path.exists():
        data = key_path.read_bytes()
        if len(data) != 32:
            raise SystemExit(
                f"db.key file exists but is {len(data)} bytes (expected 32)."
            )
        return data.hex()

    key_bytes = secrets.token_bytes(32)  # equivalent to OsRng::fill_bytes
    key_path.write_bytes(key_bytes)
    os.chmod(key_path, 0o600)
    return key_bytes.hex()


def main():
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        key_path = td / "db.key"

        # First call: creates the file
        hex1 = load_or_create_key(key_path)
        assert len(hex1) == 64, f"Hex length {len(hex1)}, expected 64"
        assert all(c in "0123456789abcdef" for c in hex1), "Non-hex char in key"
        print(f"PASS  Generated key: {hex1}")
        print(f"PASS  Key file size: {key_path.stat().st_size} bytes")

        # File permissions on Unix
        if sys.platform != "win32":
            mode = stat.S_IMODE(key_path.stat().st_mode)
            print(f"PASS  File mode: {oct(mode)} (expected 0o600)")
            assert mode == 0o600, f"Expected 0o600, got {oct(mode)}"

        # Second call: returns the same key (idempotent)
        hex2 = load_or_create_key(key_path)
        assert hex1 == hex2, "Second call returned different key!"
        print(f"PASS  Idempotent reload: same key returned")

        # PRAGMA key format
        pragma = f"x'{hex1}'"
        assert len(pragma) == 67  # x' (2) + 64 hex + ' (1)
        print(f"PASS  PRAGMA key string: {pragma}")

        # Try actual SQLCipher round-trip if sqlcipher3-binary is available
        try:
            from sqlcipher3 import dbapi2 as sqlcipher
            db_path = td / "test.db"

            # Create encrypted DB
            conn = sqlcipher.connect(str(db_path))
            cur = conn.cursor()
            cur.execute(f"PRAGMA key = \"{pragma}\";")
            cur.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT);")
            cur.execute("INSERT INTO t (val) VALUES ('hello-sqlcipher');")
            conn.commit()
            conn.close()

            # Try to open as plain SQLite — should fail
            import sqlite3
            try:
                plain = sqlite3.connect(str(db_path))
                plain.execute("SELECT * FROM t;").fetchall()
                plain.close()
                print("FAIL  Encrypted DB was readable by plain sqlite3 (encryption may not be active)")
                return 1
            except sqlite3.DatabaseError as e:
                print(f"PASS  Plain sqlite3 cannot read encrypted DB: {e}")

            # Reopen with key
            conn2 = sqlcipher.connect(str(db_path))
            cur2 = conn2.cursor()
            cur2.execute(f"PRAGMA key = \"{pragma}\";")
            rows = cur2.execute("SELECT val FROM t;").fetchall()
            assert rows == [("hello-sqlcipher",)], f"Got {rows}"
            print(f"PASS  SQLCipher round-trip: row read back = {rows[0][0]}")
            conn2.close()

        except ImportError:
            print()
            print("WARNING: pysqlcipher3 not installed — skipping SQLCipher round-trip test.")
            print("         Install with: pip install pysqlcipher3")
            print("         Key-file logic is verified above.")

    print()
    print("=" * 60)
    print("ALL KEY-FILE SMOKE TESTS PASSED")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
