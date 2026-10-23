import { LedgerTransaction, Student, FeePayment } from '../types';

const SPREADSHEET_NAME = 'Samdania Madrasah Management Ledger';

// Search Google Drive for our spreadsheet
export async function findSpreadsheet(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Drive API error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error finding spreadsheet:', error);
    return null;
  }
}

// Create a new spreadsheet with the required sheets
export async function createSpreadsheet(accessToken: string): Promise<string> {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: SPREADSHEET_NAME,
        },
        sheets: [
          { properties: { title: 'Students' } },
          { properties: { title: 'IncomeExpense' } },
          { properties: { title: 'FeePayments' } },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.statusText}`);
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;

    // Initialize headers for each sheet
    await initializeHeaders(accessToken, spreadsheetId);

    return spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

// Write the header rows to the spreadsheet tabs
async function initializeHeaders(accessToken: string, spreadsheetId: string) {
  const studentHeaders = [
    'ID', 'Name', 'Roll', 'Class', 'Contact', 'Previous Due', 
    'Current Month Fee', 'Exam Fee', 'Transport', 'Electricity', 
    'Water', 'Waiver', 'Advance Paid'
  ];

  const transactionHeaders = [
    'ID', 'Date', 'Type', 'Fund', 'Category', 'Amount', 'Description', 'Recorded By'
  ];

  const paymentHeaders = [
    'ID', 'Date', 'Receipt No', 'Student ID', 'Student Name', 'Class', 'Month', 
    'Previous Due', 'Current Month Fee', 'Exam Fee', 'Transport', 
    'Electricity', 'Water', 'Waiver', 'Advance Paid', 'Total Payable', 'Amount Paid', 'Recorded By'
  ];

  const body = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Students!A1:M1', values: [studentHeaders] },
      { range: 'IncomeExpense!A1:H1', values: [transactionHeaders] },
      { range: 'FeePayments!A1:R1', values: [paymentHeaders] },
    ],
  };

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to initialize spreadsheet headers: ${response.statusText}`);
  }
}

// Read all data from Google Sheets
export async function fetchSpreadsheetData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ students: Student[]; ledger: LedgerTransaction[]; payments: FeePayment[] }> {
  try {
    const ranges = ['Students!A2:M1000', 'IncomeExpense!A2:H2000', 'FeePayments!A2:R2000'];
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sheets data: ${response.statusText}`);
    }

    const data = await response.json();
    const valueRanges = data.valueRanges || [];

    // Parse Students
    const studentRows = valueRanges[0]?.values || [];
    const students: Student[] = studentRows.map((row: any) => ({
      id: row[0] || '',
      name: row[1] || '',
      roll: parseInt(row[2]) || 0,
      class: row[3] || '',
      contact: row[4] || '',
      previousDue: parseFloat(row[5]) || 0,
      currentMonthFee: parseFloat(row[6]) || 0,
      examFee: parseFloat(row[7]) || 0,
      transport: parseFloat(row[8]) || 0,
      electricity: parseFloat(row[9]) || 0,
      water: parseFloat(row[10]) || 0,
      waiver: parseFloat(row[11]) || 0,
      advancePaid: parseFloat(row[12]) || 0,
    }));

    // Parse Ledger Transactions
    const ledgerRows = valueRanges[1]?.values || [];
    const ledger: LedgerTransaction[] = ledgerRows.map((row: any) => ({
      id: row[0] || '',
      date: row[1] || '',
      type: (row[2] as 'Income' | 'Expense') || 'Income',
      fund: (row[3] as any) || 'General',
      category: row[4] || '',
      amount: parseFloat(row[5]) || 0,
      description: row[6] || '',
      recordedBy: row[7] || '',
    }));

    // Parse Fee Payments
    const paymentRows = valueRanges[2]?.values || [];
    const payments: FeePayment[] = paymentRows.map((row: any) => ({
      id: row[0] || '',
      date: row[1] || '',
      receiptNo: row[2] || '',
      studentId: row[3] || '',
      studentName: row[4] || '',
      class: row[5] || '',
      month: row[6] || '',
      previousDue: parseFloat(row[7]) || 0,
      currentMonthFee: parseFloat(row[8]) || 0,
      examFee: parseFloat(row[9]) || 0,
      transport: parseFloat(row[10]) || 0,
      electricity: parseFloat(row[11]) || 0,
      water: parseFloat(row[12]) || 0,
      waiver: parseFloat(row[13]) || 0,
      advancePaid: parseFloat(row[14]) || 0,
      totalPayable: parseFloat(row[15]) || 0,
      amountPaid: parseFloat(row[16]) || 0,
      recordedBy: row[17] || '',
    }));

    return { students, ledger, payments };
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    throw error;
  }
}

// Write all data back to Google Sheets (overwrite whole ranges)
export async function saveAllToSheets(
  accessToken: string,
  spreadsheetId: string,
  data: { students: Student[]; ledger: LedgerTransaction[]; payments: FeePayment[] }
): Promise<void> {
  try {
    // 1. Convert lists to cell values arrays
    const studentValues = data.students.map((st) => [
      st.id, st.name, st.roll, st.class, st.contact, st.previousDue,
      st.currentMonthFee, st.examFee, st.transport, st.electricity,
      st.electricity, st.waiver, st.advancePaid
    ]);

    const ledgerValues = data.ledger.map((tx) => [
      tx.id, tx.date, tx.type, tx.fund, tx.category, tx.amount, tx.description, tx.recordedBy
    ]);

    const paymentValues = data.payments.map((p) => [
      p.id, p.date, p.receiptNo, p.studentId, p.studentName, p.class, p.month,
      p.previousDue, p.currentMonthFee, p.examFee, p.transport,
      p.electricity, p.water, p.waiver, p.advancePaid, p.totalPayable, p.amountPaid, p.recordedBy
    ]);

    // Clear old values first to avoid orphaned rows
    await clearSheet(accessToken, spreadsheetId, 'Students!A2:M1000');
    await clearSheet(accessToken, spreadsheetId, 'IncomeExpense!A2:H2000');
    await clearSheet(accessToken, spreadsheetId, 'FeePayments!A2:R2000');

    // Batch update with new values
    const body = {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Students!A2:M${studentValues.length + 1}`, values: studentValues },
        { range: `IncomeExpense!A2:H${ledgerValues.length + 1}`, values: ledgerValues },
        { range: `FeePayments!A2:R${paymentValues.length + 1}`, values: paymentValues },
      ],
    };

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to batch update spreadsheet: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving data to spreadsheet:', error);
    throw error;
  }
}

// Clear a specific range in the spreadsheet
async function clearSheet(accessToken: string, spreadsheetId: string, range: string) {
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.warn(`Could not clear range ${range}:`, err);
  }
}

// Append a single ledger transaction to Google Sheets live
export async function appendLedgerRow(
  accessToken: string,
  spreadsheetId: string,
  tx: LedgerTransaction
): Promise<void> {
  const row = [
    tx.id, tx.date, tx.type, tx.fund, tx.category, tx.amount, tx.description, tx.recordedBy
  ];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/IncomeExpense!A2:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to append transaction: ${response.statusText}`);
  }
}

// Append a single payment row to Google Sheets live
export async function appendPaymentRow(
  accessToken: string,
  spreadsheetId: string,
  p: FeePayment
): Promise<void> {
  const row = [
    p.id, p.date, p.receiptNo, p.studentId, p.studentName, p.class, p.month,
    p.previousDue, p.currentMonthFee, p.examFee, p.transport,
    p.electricity, p.water, p.waiver, p.advancePaid, p.totalPayable, p.amountPaid, p.recordedBy
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/FeePayments!A2:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to append payment: ${response.statusText}`);
  }
}

// Update student record in Google Sheets live (Requires finding the row or overwriting Students sheet)
// Overwriting is safest if we have full synced list, but we can do a complete Students sheet rewrite for simplicity!
export async function rewriteStudentsSheet(
  accessToken: string,
  spreadsheetId: string,
  students: Student[]
): Promise<void> {
  const studentValues = students.map((st) => [
    st.id, st.name, st.roll, st.class, st.contact, st.previousDue,
    st.currentMonthFee, st.examFee, st.transport, st.electricity,
    st.water, st.waiver, st.advancePaid
  ]);

  await clearSheet(accessToken, spreadsheetId, 'Students!A2:M1000');

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Students!A2:M${studentValues.length + 1}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: studentValues }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update students sheet: ${response.statusText}`);
  }
}
