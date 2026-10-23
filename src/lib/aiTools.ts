// Agent-mode tools for the AI Assistant. These are OpenAI-compatible function
// definitions consumed by Groq. The executor runs entirely client-side: it reads
// the live database (via dbGet) and performs writes through the App's own action
// callbacks, so every change stays consistent with the rest of the UI.
import { dbGet } from './localDb';
import type { Student, FeePayment, LoanRecord } from '../types';

export interface AgentActions {
  addStudent: (data: Omit<Student, 'id'>) => void;
  editStudent: (student: Student) => void;
  deleteStudent: (id: string) => void;
  collectPayment: (data: Omit<FeePayment, 'id' | 'receiptNo' | 'invoiceNo' | 'recordedBy'>) => void;
  addLoan: (data: Omit<LoanRecord, 'id' | 'repaidAmount' | 'status' | 'recordedBy'>) => void;
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = dbGet(key);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function findStudent(ref: string | undefined, all: Student[]): Student | undefined {
  if (!ref) return undefined;
  const q = ref.trim().toLowerCase();
  return all.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q);
}

// ── The tool schema sent to the model ──
export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_data',
      description:
        'Read live records from the school database. Use this for any question that needs real data (counts, lists, invoices, balances, attendance, loans, salaries, results). Prefer this over guessing.',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: [
              'students',
              'payments',
              'ledger',
              'teachers',
              'salaries',
              'results',
              'loans',
              'loanPayments',
              'attendance',
              'studentAttendance',
              'teacherAccounts',
              'hifzStudents',
              'hifzPayments',
              'hifzLedger',
            ],
            description: 'Which table to read.',
          },
          query: {
            type: 'string',
            description: 'Optional free-text filter, e.g. a student name, class, or month.',
          },
          limit: { type: 'number', description: 'Max rows to return (default 50).' },
        },
        required: ['table'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_student',
      description:
        'Create a brand-new student record. REQUIRED fields: name, roll, class, contact, fatherName. The AI must confirm ALL required fields are present and valid BEFORE calling this. If any are missing, do NOT call — instead ask the user for the missing information.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "Student's full name." },
          roll: { type: 'string', description: 'Roll / admission number (e.g. 1, ১, ১ক, 1A).' },
          class: { type: 'string', description: 'Academic class, e.g. "Class 1", "Play", "Hifz".' },
          contact: { type: 'string', description: "Guardian contact number." },
          fatherName: { type: 'string', description: "Father's name." },
          motherName: { type: 'string', description: "Mother's name (optional)." },
          previousDue: { type: 'number', description: 'Opening previous due amount (default 0).' },
          currentMonthFee: { type: 'number', description: 'Current month fee (default 0).' },
          extraInfo: { type: 'string', description: 'Any extra notes (optional).' },
        },
        required: ['name', 'roll', 'class', 'contact', 'fatherName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_student',
      description:
        'Update an existing student. Identify them by id OR name (exact match preferred). Only include the fields to change.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Student ID (ST-xxx). Provide if known.' },
          name: { type: 'string', description: 'Current student name to look up if id not provided.' },
          patch: {
            type: 'object',
            description: 'Fields to update.',
            properties: {
              name: { type: 'string' },
              roll: { type: 'string' },
              class: { type: 'string' },
              contact: { type: 'string' },
              fatherName: { type: 'string' },
              motherName: { type: 'string' },
              previousDue: { type: 'number' },
              currentMonthFee: { type: 'number' },
              examFee: { type: 'number' },
              transport: { type: 'number' },
              electricity: { type: 'number' },
              water: { type: 'number' },
              waiver: { type: 'number' },
              advancePaid: { type: 'number' },
              extraInfo: { type: 'string' },
            },
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_student',
      description: 'Delete a student permanently. Identify by id OR name. Confirm the name before deleting.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Student ID (ST-xxx).' },
          name: { type: 'string', description: 'Student name to look up if id not provided.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'record_fee_payment',
      description:
        'Record a fee payment for a student. Identifies the student by studentId OR studentName. Provide month, date (YYYY-MM-DD) and amountPaid. The system automatically updates the student\'s outstanding balance and creates the invoice + ledger entry.',
      parameters: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student ID (ST-xxx).' },
          studentName: { type: 'string', description: 'Student name to look up if id not provided.' },
          month: { type: 'string', description: 'Month the payment is for, e.g. "July".' },
          date: { type: 'string', description: 'Payment date YYYY-MM-DD.' },
          amountPaid: { type: 'number', description: 'Amount paid.' },
        },
        required: ['month', 'date', 'amountPaid'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_loan',
      description:
        'Add a new loan/fund entry. type must be "Given", "Taken" or "ZakatLillah".',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          type: { type: 'string', enum: ['Given', 'Taken', 'ZakatLillah'] },
          personName: { type: 'string', description: 'Borrower or lender name.' },
          contact: { type: 'string', description: 'Contact number (optional).' },
          amount: { type: 'number', description: 'Loan amount.' },
          description: { type: 'string', description: 'Note / purpose (optional).' },
        },
        required: ['date', 'type', 'personName', 'amount'],
      },
    },
  },
];

const TABLE_KEYS: Record<string, string> = {
  students: 'samdani_students',
  payments: 'samdani_payments',
  ledger: 'samdani_ledger',
  teachers: 'samdani_teachers_staff',
  salaries: 'samdani_salary_payments',
  results: 'samdani_student_results',
  loans: 'samdani_loans',
  loanPayments: 'samdani_loan_payments',
  attendance: 'samdani_attendance_records',
  studentAttendance: 'samdani_student_attendance_records',
  teacherAccounts: 'samdani_teacher_accounts',
  hifzStudents: 'samdani_hifz_students',
  hifzPayments: 'samdani_hifz_payments',
  hifzLedger: 'samdani_hifz_ledger',
};

function trimForTool(rows: any[], limit: number): string {
  const sliced = limit && limit > 0 ? rows.slice(0, limit) : rows.slice(0, 50);
  return JSON.stringify(sliced, null, 2);
}

export interface ToolResult {
  name: string;
  content: string; // returned to the model as the tool message
}

/**
 * Execute a single tool call and return the result string. Never throws — errors
 * are returned as a message so the model can recover / ask the user.
 */
export function executeTool(call: { name: string; arguments: string }, actions: AgentActions): ToolResult {
  const name = call.name;
  let args: Record<string, any> = {};
  try {
    args = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    return { name, content: 'ERROR: tool arguments were not valid JSON.' };
  }

  try {
    switch (name) {
      case 'read_data': {
        const table = args.table as string;
        const key = TABLE_KEYS[table];
        if (!key) return { name, content: `ERROR: unknown table "${table}".` };
        let rows: any[] = safeGet<any[]>(key, []);
        const q = (args.query as string)?.trim().toLowerCase();
        if (q && Array.isArray(rows)) {
          rows = rows.filter((r) =>
            Object.values(r || {}).some((v) => String(v ?? '').toLowerCase().includes(q))
          );
        }
        const limit = num(args.limit, 50);
        return {
          name,
          content: `Read ${rows.length} row(s) from "${table}":\n${trimForTool(rows, limit)}`,
        };
      }

      case 'create_student': {
        const required: (keyof Student)[] = ['name', 'roll', 'class', 'contact', 'fatherName'];
        const missing = required.filter((k) => {
          const v = args[k as string];
          return v == null || (typeof v === 'string' && v.trim() === '');
        });
        if (missing.length) {
          return {
            name,
            content: `INCOMPLETE: cannot create student. Missing/invalid required fields: ${missing.join(', ')}. Ask the user for these before creating.`,
          };
        }
        if (args.roll == null || !String(args.roll).trim()) {
          return { name, content: 'INVALID: "roll" cannot be empty.' };
        }
        const all = safeGet<Student[]>('samdani_students', []);
        const dup = all.find((s) => s.name.toLowerCase() === String(args.name).toLowerCase());
        if (dup) {
          return {
            name,
            content: `A student named "${args.name}" already exists (ID ${dup.id}). Did you mean to update them instead?`,
          };
        }
        const data: Omit<Student, 'id'> = {
          name: String(args.name).trim(),
          roll: String(args.roll).trim(),
          class: String(args.class).trim(),
          contact: String(args.contact).trim(),
          fatherName: String(args.fatherName).trim(),
          motherName: args.motherName ? String(args.motherName).trim() : '',
          extraInfo: args.extraInfo ? String(args.extraInfo) : '',
          previousDue: Math.max(0, num(args.previousDue)),
          currentMonthFee: Math.max(0, num(args.currentMonthFee)),
          examFee: 0,
          transport: 0,
          electricity: 0,
          water: 0,
          waiver: 0,
          advancePaid: 0,
        };
        actions.addStudent(data);
        return {
          name,
          content: `SUCCESS: created student "${data.name}" (Roll ${data.roll}, Class ${data.class}). A new student ID was auto-assigned.`,
        };
      }

      case 'update_student': {
        const all = safeGet<Student[]>('samdani_students', []);
        const target = findStudent(args.id || args.name, all);
        if (!target) return { name, content: `ERROR: no student found for "${args.id || args.name}".` };
        const patch = { ...(args.patch || {}) };
        if (patch.roll !== undefined) {
          patch.roll = String(patch.roll).trim();
        }
        const updated: Student = { ...target, ...patch };
        actions.editStudent(updated);
        return { name, content: `SUCCESS: updated student ${target.id} (${target.name}).` };
      }

      case 'delete_student': {
        const all = safeGet<Student[]>('samdani_students', []);
        const target = findStudent(args.id || args.name, all);
        if (!target) return { name, content: `ERROR: no student found for "${args.id || args.name}".` };
        actions.deleteStudent(target.id);
        return { name, content: `SUCCESS: deleted student ${target.id} (${target.name}).` };
      }

      case 'record_fee_payment': {
        const all = safeGet<Student[]>('samdani_students', []);
        const student = findStudent(args.studentId || args.studentName, all);
        if (!student) {
          return { name, content: `ERROR: no student found for "${args.studentId || args.studentName}".` };
        }
        const amountPaid = num(args.amountPaid);
        if (amountPaid <= 0) return { name, content: 'ERROR: amountPaid must be greater than 0.' };
        const totalPayable =
          student.previousDue +
          student.currentMonthFee +
          student.examFee +
          student.transport +
          student.electricity +
          student.water -
          student.waiver -
          student.advancePaid;
        const data: Omit<FeePayment, 'id' | 'receiptNo' | 'invoiceNo' | 'recordedBy'> = {
          date: String(args.date),
          studentId: student.id,
          studentName: student.name,
          class: student.class,
          month: String(args.month),
          previousDue: student.previousDue,
          currentMonthFee: student.currentMonthFee,
          examFee: student.examFee,
          transport: student.transport,
          electricity: student.electricity,
          water: student.water,
          waiver: student.waiver,
          advancePaid: student.advancePaid,
          totalPayable: Math.max(0, totalPayable),
          amountPaid,
          receivedBy: 'AI Assistant',
        };
        actions.collectPayment(data);
        return {
          name,
          content: `SUCCESS: recorded ${amountPaid} payment for ${student.name} (${args.month}). Invoice + ledger entry created automatically.`,
        };
      }

      case 'add_loan': {
        const type = args.type as 'Given' | 'Taken' | 'ZakatLillah';
        if (!['Given', 'Taken', 'ZakatLillah'].includes(type)) {
          return { name, content: 'ERROR: type must be "Given", "Taken" or "ZakatLillah".' };
        }
        const amount = num(args.amount);
        if (amount <= 0) return { name, content: 'ERROR: amount must be greater than 0.' };
        actions.addLoan({
          date: String(args.date),
          type,
          personName: String(args.personName),
          contact: args.contact ? String(args.contact) : '',
          amount,
          description: args.description ? String(args.description) : '',
        });
        return {
          name,
          content: `SUCCESS: added ${type} loan of ${amount} for ${args.personName}.`,
        };
      }

      default:
        return { name, content: `ERROR: unknown tool "${name}".` };
    }
  } catch (e: any) {
    return { name, content: `ERROR executing ${name}: ${e?.message || String(e)}` };
  }
}
