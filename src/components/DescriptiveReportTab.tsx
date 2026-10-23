import React, { useMemo, useState } from 'react';
import { FileText, Printer, RefreshCw } from 'lucide-react';
import { LedgerTransaction } from '../types';
import { numberToBengaliWords, toBengaliDigits } from '../lib/bengaliNumbers';

interface Props { ledger: LedgerTransaction[]; }
type ReportType = 'daily' | 'monthly' | 'custom';

const CLASS_OPTIONS = ['শিশু', 'প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম'];
const FUND_OPTIONS = ['শিট থেকে আয়', 'লিল্লাহ ফান্ড', 'যাকাত ফান্ড', 'ঋণ থেকে আয়', 'বিবিধ আয়'];
const REPORT_CLASSES = [...CLASS_OPTIONS, ...FUND_OPTIONS];
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const monthEnd = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
const dateBn = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
const dayBn = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('bn-BD', { weekday: 'long' });
const money = (value: number) => `৳ ${toBengaliDigits(Math.round(value))}`;
const words = (value: number) => `${numberToBengaliWords(Math.round(value))} মাত্র`;

export default function DescriptiveReportTab({ ledger }: Props) {
  const [type, setType] = useState<ReportType>('monthly');
  const [classFilter, setClassFilter] = useState('all');
  const [singleDate, setSingleDate] = useState(today);
  const [month, setMonth] = useState(monthNow);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [generated, setGenerated] = useState(true);

  const range = useMemo(() => {
    if (type === 'daily') return { start: singleDate, end: singleDate, title: `তারিখ: ${dateBn(singleDate)} (${dayBn(singleDate)})` };
    if (type === 'custom') return { start: startDate, end: endDate, title: `সময়কাল: ${dateBn(startDate)} হতে ${dateBn(endDate)}` };
    return { start: `${month}-01`, end: monthEnd(month), title: `মাস: ${new Date(`${month}-01T00:00:00`).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })} (তারিখ: ${dateBn(`${month}-01`)} হতে ${dateBn(monthEnd(month))})` };
  }, [type, singleDate, month, startDate, endDate]);

  const rows = useMemo(() => ledger.filter((entry) => {
    const inRange = entry.date >= range.start && entry.date <= range.end;
    const matchesFilter = classFilter === 'all' || entry.category === classFilter || entry.fund === classFilter;
    return inRange && matchesFilter;
  }), [ledger, range, classFilter]);
  const incomes = rows.filter((entry) => entry.type === 'Income');
  const expenses = rows.filter((entry) => entry.type === 'Expense');
  const totalIncome = incomes.reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalIncome - totalExpense;
  const incomeSectors = Object.entries(incomes.reduce<Record<string, number>>((out, entry) => { out[entry.category] = (out[entry.category] || 0) + entry.amount; return out; }, {}));
  const expenseSectors = Object.entries(expenses.reduce<Record<string, number>>((out, entry) => { out[entry.category] = (out[entry.category] || 0) + entry.amount; return out; }, {}));
  const classBreakdown = Object.entries(incomes.reduce<Record<string, { count: number; amount: number }>>((out, entry) => { const key = entry.category || 'অন্যান্য'; out[key] = out[key] || { count: 0, amount: 0 }; out[key].count += 1; out[key].amount += entry.amount; return out; }, Object.fromEntries(REPORT_CLASSES.map((key) => [key, { count: 0, amount: 0 }]))));
  const classNarrative = classBreakdown.map(([key, value]) => <><strong>{key}</strong> শ্রেণীতে মোট {toBengaliDigits(value.count)} টি রসিদ মারফত {money(value.amount)}; </>);

  const generate = () => setGenerated(true);
  const print = () => {
    setGenerated(true);
    document.body.classList.add('printing-report');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'), { once: true });
    window.setTimeout(() => window.print(), 0);
  };
  const percent = (amount: number) => totalIncome ? `${toBengaliDigits(((amount / totalIncome) * 100).toFixed(1))}%` : '০%';

  return <div id="tab-reports" className="space-y-5">
    <section className="report-controls-card no-print">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-sky-700" />পরিপূর্ণ বর্ণনামূলক প্রতিবেদন ও প্রিন্ট জেনারেটর</h2><div className="flex gap-2"><button onClick={generate} className="report-primary-button"><RefreshCw className="h-4 w-4" /> রিপোর্ট তৈরি করুন</button><button onClick={print} className="report-success-button"><Printer className="h-4 w-4" /> প্রিন্ট করুন (A4 / PDF)</button></div></div>
      <div className="report-filter-bar">
        <label>রিপোর্টের ধরন<select id="report-type-select" value={type} onChange={(e) => setType(e.target.value as ReportType)}><option value="daily">দৈনিক হিসাব বিবরণী</option><option value="monthly">মাসিক বর্ণনামূলক অডিট ও হিসাব প্রতিবেদন</option><option value="custom">নির্দিষ্ট সময়কাল (Custom Date Range)</option></select></label>
        <label>শ্রেণি/তহবিল<select id="report-class-select" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setGenerated(false); }}><option value="all">সকল শ্রেণি ও তহবিল (সার্বিক হিসাব)</option><optgroup label="শিক্ষাগত শ্রেণি">{CLASS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup><optgroup label="মাদ্রাসার বিশেষ তহবিল ও বিবিধ">{FUND_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup></select></label>
        {type === 'daily' && <label>তারিখ<input id="report-single-date" type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} /></label>}
        {type === 'monthly' && <label>মাস<input id="report-month-select" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
        {type === 'custom' && <><label>শুরু<input id="report-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>শেষ<input id="report-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></>}
      </div>
    </section>

    <section id="report-output-container" className="report-output-container">
      {!generated ? <div className="report-empty-state">রিপোর্ট তৈরি করতে উপরের বোতামটি চাপুন।</div> : <>
        <header className="report-institute-header"><h1>সামদানিয়া তালিমুল ইসলাম মাদ্রাসা, গলাচিপা</h1><p>শ্রেণীভিত্তিক দৈনিক আয়-ব্যয় ও হিসাব শাখা</p><span>ঠিকানা: পীর বদরুল ইসলাম সামদানী কমপ্লেক্স, খানকায়ে ফুরফুরা শরীফ, ২ নং ওয়ার্ড, গলাচিপা, পটুয়াখালী | মোবাইল: 01792776433</span><strong>মাসিক/মেয়াদী পূর্ণাঙ্গ বর্ণনামূলক অডিট ও হিসাব প্রতিবেদন</strong><em>{range.title}</em></header>
        <div className="report-title-badge">হিসাবের বর্ণনামূলক পর্যালোচনা</div>
        {classFilter !== 'all' ? <ClassSpecificReport target={classFilter} rows={rows} periodTitle={range.title} /> : <>
        <div className="report-summary-grid"><div className="report-stat income"><span>মোট আয়</span><strong>{money(totalIncome)}</strong></div><div className="report-stat expense"><span>মোট ব্যয়</span><strong>{money(totalExpense)}</strong></div><div className="report-stat balance"><span>নিট উদ্বৃত্ত</span><strong>{money(balance)}</strong></div></div>
        <div className="narrative-box"><h3>হিসাবের বর্ণনামূলক পর্যালোচনা</h3><p><strong>পরিপূর্ণ মাসিক/মেয়াদী হিসাব বিবরণী:</strong> পর্যালোচিত {range.title} মেয়াদে প্রতিষ্ঠানে ছাত্রছাত্রীদের বেতন, ফি ও বিবিধ খাত হতে সর্বমোট <b className="narrative-success">{money(totalIncome)}</b> আদায় হয়েছে। একই সময়কালে প্রাতিষ্ঠানিক প্রশাসনিক, স্টেশনারি ও পরিচালন ব্যয় হিসেবে মোট <b className="narrative-danger">{money(totalExpense)}</b> পরিশোধ করা হয়েছে। হিসাব সমাপনান্তে উক্ত সময়ের নিট উদ্বৃত্ত/স্থাবর ক্যাশ ব্যালেন্স নির্ধারিত হয়েছে <b className="narrative-highlight">{money(balance)}</b> (কথায়: <em>{words(balance)}</em>)।</p><p><strong>শ্রেণীভিত্তিক মোট আদায়:</strong> {classNarrative}</p></div>
        <ReportTable title="শ্রেণী/খাতভিত্তিক মোট আদায়" headers={['ক্র.নং', 'শ্রেণী/খাত', 'রসিদ সংখ্যা', 'মোট আদায়', 'শতাংশ']} rows={classBreakdown.map(([key, value], index) => [toBengaliDigits(index + 1), key, toBengaliDigits(value.count), money(value.amount), percent(value.amount)])} footer={['', 'মোট', toBengaliDigits(incomes.length), money(totalIncome), totalIncome ? '১০০%' : '০%']} />
        <div className="report-two-column"><ReportTable title="আয়ের খাত" headers={['খাত', 'টাকা']} rows={incomeSectors.map(([key, value]) => [key, money(value)])} /><ReportTable title="ব্যয়ের খাত" headers={['খাত', 'টাকা']} rows={expenseSectors.map(([key, value]) => [key, money(value)])} /></div>
        <ReportTable title="বিস্তারিত আয় লেনদেন" headers={['রসিদ নং', 'তারিখ', 'শ্রেণি/তহবিল', 'বিবরণ', 'খাত', 'টাকা']} rows={incomes.map((entry) => [entry.id, dateBn(entry.date), entry.fund, entry.description || '—', entry.category, money(entry.amount)])} />
        <ReportTable title="বিস্তারিত ব্যয় লেনদেন" headers={['ক্র.নং', 'তারিখ', 'ব্যয়ের খাত', 'মন্তব্য/বিবরণ', 'টাকা']} rows={expenses.map((entry, index) => [toBengaliDigits(index + 1), dateBn(entry.date), entry.category, entry.description || '—', money(entry.amount)])} />
        <div className="print-signatures"><div>প্রস্তুতকারীর স্বাক্ষর</div><div>হিসাবরক্ষকের স্বাক্ষর</div><div>অধ্যক্ষের স্বাক্ষর</div></div>
        </>}
      </>}
    </section>
  </div>;
}

function ClassSpecificReport({ target, rows, periodTitle }: { target: string; rows: LedgerTransaction[]; periodTitle: string }) {
  const incomes = rows.filter((entry) => entry.type === 'Income');
  const total = incomes.reduce((sum, entry) => sum + entry.amount, 0);
  const sectors = Object.entries(incomes.reduce<Record<string, { count: number; amount: number }>>((out, entry) => { const key = entry.category || 'অন্যান্য'; out[key] = out[key] || { count: 0, amount: 0 }; out[key].count += 1; out[key].amount += entry.amount; return out; }, {}));
  const average = incomes.length ? total / incomes.length : 0;
  return <>
    <div className="report-summary-grid"><div className="report-stat income"><span>{target}-এর সর্বমোট আদায়</span><strong>{money(total)}</strong></div><div className="report-stat balance"><span>রসিদ/এন্ট্রি সংখ্যা</span><strong>{toBengaliDigits(incomes.length)}</strong></div><div className="report-stat month-income"><span>গড় জমা</span><strong>{money(average)}</strong></div></div>
    <div className="narrative-box"><h3>{target}-এর প্রাতিষ্ঠানিক পর্যালোচনা</h3><p>পর্যালোচিত {periodTitle} সময়ে <strong>{target}</strong> খাতে মোট <b className="narrative-success">{money(total)}</b> আদায় হয়েছে। টাকা কথায়: <b className="narrative-highlight">{words(total)}</b>। মোট রসিদ সংখ্যা {toBengaliDigits(incomes.length)} টি।</p></div>
    <ReportTable title={`${target}-এর খাতভিত্তিক আদায়`} headers={['ক্র.নং', 'আদায়ের খাত', 'রসিদ সংখ্যা', 'মোট আদায়', 'শতাংশ']} rows={sectors.map(([key, value], index) => [toBengaliDigits(index + 1), key, toBengaliDigits(value.count), money(value.amount), total ? `${toBengaliDigits(((value.amount / total) * 100).toFixed(1))}%` : '০%'])} footer={['', 'মোট', toBengaliDigits(incomes.length), money(total), total ? '১০০%' : '০%']} />
    <ReportTable title={`${target}-এর বিস্তারিত আদায় ও রসিদ খতিয়ান`} headers={['ক্র.নং', 'রসিদ/মেমো', 'রোল', 'নাম/বিবরণ', 'খাত', 'তারিখ', 'টাকা', 'মন্তব্য']} rows={incomes.map((entry, index) => [toBengaliDigits(index + 1), entry.id, '—', entry.description || '—', entry.category, dateBn(entry.date), money(entry.amount), entry.description || '—'])} />
    <div className="in-words-box"><strong>মোট আদায়কৃত টাকা কথায়:</strong> {words(total)}</div>
    <div className="print-signatures"><div>প্রস্তুতকারীর স্বাক্ষর</div><div>হিসাবরক্ষকের স্বাক্ষর</div><div>অধ্যক্ষের স্বাক্ষর</div></div>
  </>;
}

function ReportTable({ title, headers, rows, footer }: { title: string; headers: string[]; rows: string[][]; footer?: string[] }) {
  return <section className="report-table-section"><h3>{title}</h3>{rows.length === 0 ? <p className="report-no-data">কোনো রেকর্ড নেই</p> : <div className="report-table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>{footer && <tfoot><tr>{footer.map((cell, index) => <td key={`footer-${index}`}><strong>{cell}</strong></td>)}</tr></tfoot>}</table></div>}</section>;
}
