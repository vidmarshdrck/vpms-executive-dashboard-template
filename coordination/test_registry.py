import json
import tempfile
import unittest
from pathlib import Path
from registry import Registry


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'private'
        self.registry = Registry(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_failed_credential_persistence_rolls_back_registration(self):
        def fail(_session):
            raise OSError('disk full test')
        with self.assertRaises(OSError):
            self.registry.register('hermes', 'Bags', 'VH', '/repo', 'Work', persist=fail)
        self.assertEqual(self.registry.snapshot()['sessions'], [])
        self.assertEqual(self.registry.events(), [])

    def test_registration_update_and_restart_are_persistent_and_audited(self):
        session = self.registry.register('hermes', 'Bags', 'VH', '/repo/worktree', 'Build activity tracking', now=100)
        self.registry.update(session['session_id'], session['token'], 'blocked', 'Needs reviewed SQL route', help_needed='Project admin inspect catalog', now=110)
        rows = Registry(self.root).snapshot(now=111)['sessions']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['state'], 'blocked')
        self.assertEqual(rows[0]['help_needed'], 'Project admin inspect catalog')
        self.assertNotIn('token', json.dumps(rows))
        self.assertEqual(len(self.registry.events()), 2)
        self.assertEqual(self.root.stat().st_mode & 0o777, 0o700)
        self.assertEqual((self.root / 'activity.sqlite3').stat().st_mode & 0o777, 0o600)

    def test_credentials_and_stale_states_are_honest(self):
        s = self.registry.register('external-ai', 'Builder', 'VH', '/repo', 'Work', now=1)
        with self.assertRaises(PermissionError):
            self.registry.update(s['session_id'], 'wrong', 'working', 'Forged', now=2)
        with self.assertRaises(ValueError):
            self.registry.update(s['session_id'], s['token'], 'blocked', 'Stuck', now=2)
        row = self.registry.snapshot(now=302)['sessions'][0]
        self.assertTrue(row['stale'])
        self.assertEqual(row['evidence'], 'agent self-report')
        self.assertEqual(len(self.registry.events()), 1)

    def test_advisory_leases_detect_parent_child_conflicts_and_expire(self):
        a = self.registry.register('hermes', 'A', 'VH', '/a', 'A', now=1)
        b = self.registry.register('grok', 'B', 'VH', '/b', 'B', now=1)
        self.registry.claim(a['session_id'], a['token'], 'vhpms', 'src', now=2)
        with self.assertRaises(ValueError):
            self.registry.claim(b['session_id'], b['token'], 'vhpms', 'src/App.jsx', now=3)
        self.registry.claim(b['session_id'], b['token'], 'vhpms', 'docs', now=3)
        self.registry.claim(b['session_id'], b['token'], 'vhpms', 'src/App.jsx', now=400)
        with self.assertRaises(ValueError):
            self.registry.claim(a['session_id'], a['token'], 'vhpms', '../credentials', now=401)
        self.registry.update(b['session_id'], b['token'], 'completed', 'Tests verified', now=402)
        self.assertFalse(self.registry.snapshot(now=402)['leases'])

    def test_two_concurrent_claims_have_one_winner(self):
        from concurrent.futures import ThreadPoolExecutor
        sessions = [self.registry.register('test', name, 'VH', '/repo', 'Concurrent') for name in ['A', 'B']]
        def claim(s):
            try:
                self.registry.claim(s['session_id'], s['token'], 'vhpms', 'same/file')
                return 'won'
            except ValueError:
                return 'conflict'
        with ThreadPoolExecutor(2) as pool:
            self.assertEqual(sorted(pool.map(claim, sessions)), ['conflict', 'won'])


if __name__ == '__main__':
    unittest.main()
