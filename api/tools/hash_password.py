"""Generate an Argon2id hash for the given password.

Usage: python api/tools/hash_password.py [password]
If no password is provided, prompts interactively.
"""
import sys
from getpass import getpass

from pwdlib import PasswordHash


def main() -> None:
    if len(sys.argv) > 1:
        password = sys.argv[1]
    else:
        password = getpass("Password: ")
    h = PasswordHash.recommended().hash(password)
    print(h)


if __name__ == "__main__":
    main()
