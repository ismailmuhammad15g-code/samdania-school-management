import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffPortalSession, validateStaffPortalSession } from './staffSessions';
import type { StaffAccount, StaffPortalSession } from '../types';

const account: StaffAccount = {
  id: 'staff-1',
  fullName: 'Rahima',
  role: 'Driver',
  email: 'rahima@example.com',
  password: 'secret',
  phone: '01700000000',
  bio: '',
  contactInfo: '',
  createdAt: '2025-01-01T00:00:00.000Z',
  status: 'approved',
};

test('creates a session that validates against the matching staff account', () => {
  const session = createStaffPortalSession(account);
  assert.equal(validateStaffPortalSession(session, account), true);
});

test('rejects sessions that do not match the staff account', () => {
  const session = createStaffPortalSession(account);
  const mismatched: StaffPortalSession = { ...session, accountId: 'staff-2' };
  assert.equal(validateStaffPortalSession(mismatched, account), false);
});

test('rejects a session after the account identity changes', () => {
  const session = createStaffPortalSession(account);
  assert.equal(validateStaffPortalSession(session, { ...account, email: 'other@example.com' }), false);
});
