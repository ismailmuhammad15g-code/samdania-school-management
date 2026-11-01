import assert from 'node:assert/strict';
import test from 'node:test';
import type { Student } from '../types';
import { rolloverMonthlyFees } from './monthlyFeeRollover';

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 'ST-101',
    name: 'Student',
    roll: '1',
    class: 'One',
    contact: '',
    fatherName: '',
    motherName: '',
    extraInfo: '',
    previousDue: 0,
    currentMonthFee: 500,
    monthlyTuition: 500,
    examFee: 0,
    transport: 0,
    electricity: 0,
    water: 0,
    waiver: 0,
    advancePaid: 0,
    feeMonth: '2026-10',
    ...overrides,
  };
}

test('moves the unpaid prior month balance into previous due and starts the new month', () => {
  const result = rolloverMonthlyFees([
    student({ previousDue: 100, currentMonthFee: 500, feeMonth: '2026-10' }),
  ], new Date(2026, 10, 1));

  assert.equal(result.students[0].previousDue, 600);
  assert.equal(result.students[0].currentMonthFee, 500);
  assert.equal(result.students[0].feeMonth, '2026-11');
});

test('leaves previous due at zero when all past fees were paid', () => {
  const result = rolloverMonthlyFees([
    student({ previousDue: 0, currentMonthFee: 0, feeMonth: '2026-10' }),
  ], new Date(2026, 10, 1));

  assert.equal(result.students[0].previousDue, 0);
  assert.equal(result.students[0].currentMonthFee, 500);
});

test('accrues missed monthly tuition when the app was not opened for multiple months', () => {
  const result = rolloverMonthlyFees([
    student({ previousDue: 100, feeMonth: '2026-09' }),
  ], new Date(2026, 10, 1));

  assert.equal(result.students[0].previousDue, 1100);
  assert.equal(result.students[0].currentMonthFee, 500);
});

test('does not apply the same month rollover twice', () => {
  const currentStudent = student({ feeMonth: '2026-11', previousDue: 600 });
  const result = rolloverMonthlyFees([currentStudent], new Date(2026, 10, 1));

  assert.equal(result.changed, false);
  assert.equal(result.students[0], currentStudent);
});

test('initializes legacy students without charging them twice', () => {
  const legacyStudent = student({ feeMonth: undefined });
  const result = rolloverMonthlyFees([legacyStudent], new Date(2026, 10, 1));

  assert.equal(result.students[0].previousDue, 0);
  assert.equal(result.students[0].currentMonthFee, 500);
  assert.equal(result.students[0].feeMonth, '2026-11');
});

test('uses advance credit before carrying a balance forward', () => {
  const result = rolloverMonthlyFees([
    student({
      previousDue: 100,
      waiver: 50,
      advancePaid: 700,
      feeMonth: '2026-10',
    }),
  ], new Date(2026, 10, 1));

  assert.equal(result.students[0].previousDue, 0);
  assert.equal(result.students[0].advancePaid, 150);
});
