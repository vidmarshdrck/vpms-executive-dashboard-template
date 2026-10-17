"""Cooperative session activity CLI for authorized same-user VPS agents."""
import argparse
import json
import os
import stat
import sqlite3
import sys
from pathlib import Path
from registry import Registry


def credential(path):
    flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, 'O_NOFOLLOW', 0)
    fd = os.open(path, flags)
    with os.fdopen(fd) as stream:
        mode = os.fstat(stream.fileno())
        if not stat.S_ISREG(mode.st_mode) or mode.st_uid != os.getuid() or mode.st_mode & 0o077:
            raise ValueError('private_credential_file_required')
        content = stream.read(4097)
        if len(content) > 4096:
            raise ValueError('invalid_credential')
        data = json.loads(content)
        if not isinstance(data, dict) or any(not isinstance(data.get(k), str) or not 1 <= len(data[k]) <= 256 for k in ('session_id', 'token')):
            raise ValueError('invalid_credential')
        return data['session_id'], data['token']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(Path.home() / '.local/state/vhpms-coordination'))
    commands = parser.add_subparsers(dest='action', required=True)
    reg = commands.add_parser('register')
    for name in ['provider', 'agent', 'business', 'worktree', 'objective', 'credential']:
        reg.add_argument('--' + name, required=True)
    update = commands.add_parser('update')
    for name in ['credential', 'state', 'summary']:
        update.add_argument('--' + name, required=True)
    update.add_argument('--help-needed', default='')
    claim = commands.add_parser('claim')
    for name in ['credential', 'repo', 'scope']:
        claim.add_argument('--' + name, required=True)
    claim.add_argument('--ttl', type=int, default=300)
    commands.add_parser('snapshot')
    commands.add_parser('events')
    args = parser.parse_args()
    try:
        registry = Registry(args.root)
        if args.action == 'register':
            created = False
            def persist(session):
                nonlocal created
                fd = os.open(args.credential, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
                created = True
                with os.fdopen(fd, 'w') as stream:
                    json.dump(session, stream)
                    stream.flush()
                    os.fsync(stream.fileno())
                directory = os.open(str(Path(args.credential).parent), os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
            try:
                session = registry.register(args.provider, args.agent, args.business, args.worktree, args.objective, persist=persist)
                result = {'session_id': session['session_id'], 'credential_file': args.credential}
            except Exception:
                if created:
                    Path(args.credential).unlink(missing_ok=True)
                raise
        elif args.action == 'update':
            sid, token = credential(args.credential)
            registry.update(sid, token, args.state, args.summary, args.help_needed)
            result = {'session_id': sid, 'state': args.state, 'recorded': True, 'executed': False}
        elif args.action == 'claim':
            sid, token = credential(args.credential)
            result = registry.claim(sid, token, args.repo, args.scope, args.ttl)
        else:
            result = registry.snapshot() if args.action == 'snapshot' else registry.events()
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as error:
        # Values and credentials are never included in the error response.
        print(json.dumps({'error': type(error).__name__, 'recorded': False}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
