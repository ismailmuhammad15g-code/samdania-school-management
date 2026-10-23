import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherPortalSession, validateTeacherPortalSession } from './teacherSessions';
import type { TeacherAccount, TeacherPortalSession } from '../types';

const account: TeacherAccount = {
  id: 'acc-1',
  fullName: 'Amina',
  designation: 'Hifz Teacher',
  email: 'amina@example.com',
  password: 'secret',
  bio: '',
  registered: true,
  status: 'verified',
  createdAt: '2025-01-01T00:00:00.000Z',
};

test('creates a session that validates against the matching teacher account', () => {
  const session = createTeacherPortalSession(account);
  assert.equal(validateTeacherPortalSession(session, account), true);
});

test('rejects sessions that do not match the teacher account', () => {
  const session = createTeacherPortalSession(account);
  const mismatched: TeacherPortalSession = {
    ...session,
    accountId: 'acc-2',
  };
  assert.equal(validateTeacherPortalSession(mismatched, account), false);
});

test('rejects sessions when the account is no longer verified', () => {
  const session = createTeacherPortalSession(account);
  const unverified = { ...account, status: 'unverified' as const };
  assert.equal(validateTeacherPortalSession(session, unverified), false);
});
