import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name('activity.py')


class CliTests(unittest.TestCase):
    def test_fifo_credential_is_rejected_without_hanging(self):
        with tempfile.TemporaryDirectory() as directory:
            fifo = Path(directory) / 'credential.fifo'
            os.mkfifo(fifo, 0o600)
            result = subprocess.run([sys.executable, str(SCRIPT), '--root', str(Path(directory) / 'state'), 'update', '--credential', str(fifo), '--state', 'working', '--summary', 'Test'], capture_output=True, text=True, timeout=2)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(json.loads(result.stdout)['recorded'])

    def test_malformed_credentials_and_database_errors_are_structured(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'state'
            key = Path(directory) / 'bad.json'
            for payload in [None, [], {'session_id':'a','token':2}, {'session_id':'','token':''}]:
                key.write_text(json.dumps(payload)); key.chmod(0o600)
                result = subprocess.run([sys.executable, str(SCRIPT), '--root', str(root), 'update', '--credential', str(key), '--state', 'working', '--summary', 'Test'], capture_output=True, text=True)
                self.assertEqual(result.returncode, 1)
                self.assertNotIn('Traceback', result.stderr)
                self.assertFalse(json.loads(result.stdout)['recorded'])
            (root / 'activity.sqlite3').write_bytes(b'not a database')
            result = subprocess.run([sys.executable, str(SCRIPT), '--root', str(root), 'snapshot'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn('Traceback', result.stderr)
            self.assertFalse(json.loads(result.stdout)['recorded'])

    def test_actual_cli_register_update_claim_and_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'state'
            credential = Path(directory) / 'session.json'
            def run(*args, ok=True):
                result = subprocess.run([sys.executable, str(SCRIPT), '--root', str(root), *args], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0 if ok else 1, result.stderr)
                return json.loads(result.stdout)
            registered = run('register', '--provider', 'grok', '--agent', 'Builder', '--business', 'VH', '--worktree', '/repo', '--objective', 'Implement integration', '--credential', str(credential))
            self.assertTrue(registered['session_id'].startswith('SES-'))
            self.assertNotIn('token', registered)
            self.assertEqual(credential.stat().st_mode & 0o777, 0o600)
            run('claim', '--credential', str(credential), '--repo', 'vhpms', '--scope', 'coordination')
            run('update', '--credential', str(credential), '--state', 'handoff', '--summary', 'Ready for review', '--help-needed', 'Hermes review commit abc')
            snapshot = run('snapshot')
            self.assertEqual(snapshot['sessions'][0]['state'], 'handoff')
            self.assertEqual(snapshot['leases'], [])
            original = credential.read_bytes()
            run('register', '--provider', 'grok', '--agent', 'Builder', '--business', 'VH', '--worktree', '/repo', '--objective', 'Other', '--credential', str(credential), ok=False)
            self.assertEqual(original, credential.read_bytes())
            self.assertEqual(len(run('snapshot')['sessions']), 1)
            self.assertGreaterEqual(len(run('events')), 3)
