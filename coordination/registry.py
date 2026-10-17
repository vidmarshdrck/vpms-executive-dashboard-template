"""Private, local coordination metadata. Not the canonical VHPMS task database."""
from contextlib import contextmanager
import hashlib
import secrets
import sqlite3
import time
from pathlib import Path, PurePosixPath


class Registry:
    def __init__(self, root):
        self.root = Path(root).expanduser()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.root.is_symlink():
            raise ValueError('symlink_root_not_allowed')
        self.root.chmod(0o700)
        self.path = self.root / 'activity.sqlite3'
        if self.path.is_symlink():
            raise ValueError('symlink_database_not_allowed')
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS sessions (
                  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, provider TEXT NOT NULL,
                  agent TEXT NOT NULL, business TEXT NOT NULL, worktree TEXT NOT NULL,
                  objective TEXT NOT NULL, state TEXT NOT NULL, summary TEXT NOT NULL,
                  help_needed TEXT NOT NULL, updated REAL NOT NULL, created REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS leases (
                  repo TEXT NOT NULL, scope TEXT NOT NULL, session_id TEXT NOT NULL,
                  expires REAL NOT NULL, PRIMARY KEY(repo,scope)
                );
                CREATE TABLE IF NOT EXISTS events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
                  state TEXT NOT NULL, summary TEXT NOT NULL, help_needed TEXT NOT NULL,
                  created REAL NOT NULL
                );
            ''')
        self.path.chmod(0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA foreign_keys=ON')
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def text(value, limit=500, required=False):
        if not isinstance(value, str) or len(value) > limit or (required and not value.strip()) or '\x00' in value:
            raise ValueError('invalid_text')
        return value.strip()

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def register(self, provider, agent, business, worktree, objective, now=None, persist=None):
        provider, agent, business, worktree, objective = [self.text(v, n, True) for v, n in
            [(provider, 64), (agent, 80), (business, 64), (worktree, 500), (objective, 500)]]
        now = time.time() if now is None else now
        sid, token = 'SES-' + secrets.token_hex(12), secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                       (sid, self.digest(token), provider, agent, business, worktree, objective,
                        'working', 'Session registered; progress is self-reported.', '', now, now))
            db.execute('INSERT INTO events(session_id,state,summary,help_needed,created) VALUES (?,?,?,?,?)',
                       (sid, 'working', 'Session registered', '', now))
            if persist is not None:
                persist({'session_id': sid, 'token': token})
        return {'session_id': sid, 'token': token}

    def authorize(self, db, sid, token):
        row = db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone()
        if not row or not secrets.compare_digest(row['token_hash'], self.digest(token)):
            raise PermissionError('session_credential_required')
        return row

    def update(self, sid, token, state, summary, help_needed='', now=None):
        if state not in ('working', 'waiting', 'blocked', 'handoff', 'completed', 'failed'):
            raise ValueError('invalid_state')
        summary = self.text(summary, 1000, True)
        help_needed = self.text(help_needed, 1000)
        if state in ('blocked', 'handoff') and not help_needed:
            raise ValueError('next_action_required')
        now = time.time() if now is None else now
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.authorize(db, sid, token)
            if state in ('completed', 'failed', 'handoff'):
                db.execute('DELETE FROM leases WHERE session_id=?', (sid,))
            db.execute('UPDATE sessions SET state=?,summary=?,help_needed=?,updated=? WHERE id=?',
                       (state, summary, help_needed, now, sid))
            db.execute('INSERT INTO events(session_id,state,summary,help_needed,created) VALUES (?,?,?,?,?)',
                       (sid, state, summary, help_needed, now))

    def claim(self, sid, token, repo, scope, ttl=300, now=None):
        repo = self.text(repo, 64, True)
        scope = self.text(scope, 500, True)
        if PurePosixPath(scope).is_absolute() or '..' in PurePosixPath(scope).parts or '\\' in scope:
            raise ValueError('invalid_scope')
        scope = str(PurePosixPath(scope))
        if not isinstance(ttl, int) or not 60 <= ttl <= 1800:
            raise ValueError('invalid_lease_ttl')
        now = time.time() if now is None else now
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = self.authorize(db, sid, token)
            if row['state'] != 'working':
                raise ValueError('working_session_required')
            db.execute('DELETE FROM leases WHERE expires<=?', (now,))
            for other in db.execute('SELECT * FROM leases WHERE repo=? AND session_id<>?', (repo, sid)):
                a, b = PurePosixPath(scope), PurePosixPath(other['scope'])
                if a == b or a in b.parents or b in a.parents:
                    raise ValueError('lease_conflict:' + other['session_id'])
            db.execute('INSERT INTO leases VALUES (?,?,?,?) ON CONFLICT(repo,scope) DO UPDATE SET session_id=excluded.session_id,expires=excluded.expires',
                       (repo, scope, sid, now + ttl))
            db.execute('INSERT INTO events(session_id,state,summary,help_needed,created) VALUES (?,?,?,?,?)',
                       (sid, 'lease_claimed', repo + ':' + scope, '', now))
        return {'repo': repo, 'scope': scope, 'expires': now + ttl, 'advisory_only': True}

    def snapshot(self, now=None):
        now = time.time() if now is None else now
        with self.connect() as db:
            db.execute('BEGIN')
            rows = db.execute('SELECT id,provider,agent,business,worktree,objective,state,summary,help_needed,updated,created FROM sessions ORDER BY updated DESC LIMIT 101').fetchall()
            leases = [dict(row) for row in db.execute('SELECT * FROM leases WHERE expires>? ORDER BY repo,scope', (now,))]
        return {'leases': leases, 'coverage': 'registered sessions only; not automatic discovery or proof of execution',
                'has_more': len(rows) > 100,
                'sessions': [{**dict(row), 'stale': now - row['updated'] > 300,
                              'evidence': 'agent self-report'} for row in rows[:100]]}

    def events(self):
        with self.connect() as db:
            return [{**dict(row), 'event_ref': 'ACT-' + str(row['id']).zfill(6)} for row in
                    db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 100')]
