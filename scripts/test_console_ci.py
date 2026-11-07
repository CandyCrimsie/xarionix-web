"""CI transport regression: GitLab detached checkouts retain their identity."""

import io
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

from console_ci import git_identity


class GitIdentityTransferTests(unittest.TestCase):
    def test_detached_packed_refs_and_no_clone_credentials(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary).resolve() / "source"
            subprocess.run(["git", "init", "--quiet", str(source)], check=True)
            (source / "source.txt").write_text("fixture")
            subprocess.run(["git", "add", "."], cwd=source, check=True)
            subprocess.run(
                ["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                 "commit", "--quiet", "-m", "fixture"], cwd=source, check=True,
            )
            subprocess.run(["git", "pack-refs", "--all", "--prune"], cwd=source, check=True)
            subprocess.run(["git", "checkout", "--quiet", "--detach", "HEAD"], cwd=source, check=True)
            (source / ".git/config").write_text("[remote \"origin\"]\nurl = private-clone-url\n")
            output = io.BytesIO()
            with tarfile.open(fileobj=output, mode="w") as archive:
                git_identity(archive, source, "core")
            output.seek(0)
            restored = Path(temporary) / "restored"
            with tarfile.open(fileobj=output) as archive:
                archive.extractall(restored, filter="data")
            actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=restored / "core")
            self.assertEqual(actual, subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source))
            self.assertNotIn("private-clone-url", (restored / "core/.git/config").read_text())


if __name__ == "__main__":
    unittest.main()
