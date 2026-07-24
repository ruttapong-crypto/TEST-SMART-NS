import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { get, onValue, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
const TEMPLATE_HEADERS = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น', 'ห้อง'];
const EMPTY_FORM = { student_code: '', name: '', level: 'ม.1', class_room: '' };

export default function Students() {
  const [students, setStudents] = useState([]);
  const [preview, setPreview] = useState([]);
  const [fileError, setFileError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;
  const [addMsg, setAddMsg] = useState(null); // { type, text }
  const [columnMap, setColumnMap] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'students'),
      (snap) => {
        const list = [];
        snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
        list.sort((a, b) => String(a.student_code || '').localeCompare(String(b.student_code || '')));
        setStudents(list);
        setLoadError('');
        setLoading(false);
        setDebugInfo((prev) => ({ ...prev, onValueCount: list.length, onValueAt: new Date().toLocaleTimeString('th-TH') }));
        console.log('[SmartExam debug] onValue students snapshot children:', list.length, list.map((s) => s.student_code));
      },
      (err) => {
        setLoadError(`โหลดรายชื่อนักเรียนไม่สำเร็จ: ${err.message} (ตรวจสอบ Firebase Rules ว่า publish แล้วหรือยัง)`);
        setLoading(false);
        setDebugInfo((prev) => ({ ...prev, onValueError: err.message }));
      }
    );

    // ดึงข้อมูลแบบ one-time แยกต่างหาก เพื่อเทียบว่าตรงกับที่ onValue ได้หรือไม่ (สำหรับ debug)
    get(ref(db, 'students'))
      .then((snap) => {
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        setDebugInfo((prev) => ({ ...prev, oneTimeGetCount: count, oneTimeGetAt: new Date().toLocaleTimeString('th-TH') }));
        console.log('[SmartExam debug] one-time get() students count:', count);
      })
      .catch((err) => {
        setDebugInfo((prev) => ({ ...prev, oneTimeGetError: err.message }));
      });

    return unsub;
  }, []);

  // ปุ่มรีเฟรชสำรอง — เผื่อ realtime listener ค้างเพราะแท็บถูกเบราว์เซอร์ freeze ไว้นาน
  // แล้วการเชื่อมต่อ WebSocket ไม่ auto-reconnect (ดึงข้อมูลใหม่แบบ one-time แทน)
  const [refreshing, setRefreshing] = useState(false);
  async function manualRefresh() {
    setRefreshing(true);
    setLoadError('');
    try {
      const snap = await get(ref(db, 'students'));
      const list = [];
      snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
      list.sort((a, b) => String(a.student_code || '').localeCompare(String(b.student_code || '')));
      setStudents(list);
    } catch (err) {
      setLoadError(`รีเฟรชไม่สำเร็จ: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['10001', 'สมชาย ใจดี', 'ม.1', '1'],
      ['10002', 'สมหญิง รักเรียน', 'ม.1', '2']
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 8 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน');
    XLSX.writeFile(wb, 'แบบฟอร์มนำเข้านักเรียน.xlsx');
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // จับคู่คอลัมน์จาก "ชื่อหัวตาราง" แทนตำแหน่งตายตัว รองรับไฟล์ที่สลับลำดับคอลัมน์
        // หรือมีคอลัมน์อื่นแทรกอยู่ (เช่น เลขที่, เลขประจำตัวประชาชน) — ถ้าหาหัวตารางที่ตรงไม่เจอ
        // จะ fallback กลับไปใช้ตำแหน่งคอลัมน์ตามแบบฟอร์มมาตรฐาน (รหัส, ชื่อ, ชั้น, ห้อง)
        const headerRow = rows[0] || [];
        const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
        const findCol = (keywords) => {
          for (let i = 0; i < headerRow.length; i++) {
            const cell = norm(headerRow[i]);
            if (cell && keywords.some((k) => cell.includes(k))) return i;
          }
          return -1;
        };
        const colCode = ((c) => (c === -1 ? 0 : c))(findCol(['รหัสนักเรียน', 'รหัสประจำตัว', 'รหัส', 'code', 'id']));
        const colName = ((c) => (c === -1 ? 1 : c))(findCol(['ชื่อ-นามสกุล', 'ชื่อสกุล', 'ชื่อ', 'name']));
        const colLevel = ((c) => (c === -1 ? 2 : c))(findCol(['ระดับชั้น', 'ชั้น', 'level']));
        const colRoom = ((c) => (c === -1 ? 3 : c))(findCol(['ห้องเรียน', 'ห้อง', 'room']));

        // แปลงค่า "ชั้น" ให้เป็นรูปแบบมาตรฐาน ม.1–ม.6 ไม่ว่าในไฟล์จะพิมพ์ว่า ม1, มัธยมศึกษาปีที่ 1, 1 ฯลฯ
        function normalizeLevel(raw) {
          const s = String(raw ?? '').trim();
          if (LEVELS.includes(s)) return s;
          const m = s.match(/[1-6]/);
          if (m && /ม|มัธยม/.test(s)) return `ม.${m[0]}`;
          return s;
        }
        // แปลงค่า "ห้อง" ให้เหลือแค่ตัวเลข รองรับกรณีไฟล์เก่ายังใส่แบบ ม.1/2 มา
        function normalizeRoom(raw) {
          const s = String(raw ?? '').trim();
          if (s.includes('/')) return s.split('/').pop().trim();
          return s;
        }

        const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ''));

        // เซลล์ผสาน (merged cells) ในไฟล์ Excel ของโรงเรียนมักใช้กับคอลัมน์ "ชั้น" และ "ห้อง"
        // เมื่ออ่านด้วยไลบรารีจะได้ค่าเฉพาะแถวบนสุดของกลุ่มที่ผสาน แถวที่เหลือจะว่างเปล่า
        // จึงต้อง "เติมค่าจากแถวก่อนหน้า" (forward-fill) ให้ทั้งสองคอลัมน์นี้ ไม่เช่นนั้นแถวส่วนใหญ่
        // จะถูกมองว่าข้อมูลไม่ครบและถูกข้ามไปอย่างเงียบๆ (เหลือแค่นักเรียนคนแรกของแต่ละกลุ่ม)
        let lastLevel = '';
        let lastRoom = '';
        const parsed = dataRows.map((r, i) => {
          const studentCode = String(r[colCode] ?? '').trim();
          const name = String(r[colName] ?? '').trim();
          let level = normalizeLevel(r[colLevel]);
          let classRoom = normalizeRoom(r[colRoom]);

          if (level) lastLevel = level;
          else if (studentCode || name) level = lastLevel; // เติมจากแถวบน เฉพาะแถวที่มีข้อมูลนักเรียนจริง

          if (classRoom) lastRoom = classRoom;
          else if (studentCode || name) classRoom = lastRoom;

          return { row: i + 2, student_code: studentCode, name, level, class_room: classRoom };
        });

        const duplicatesInFile = parsed.filter(
          (p, idx) => p.student_code && parsed.findIndex((q) => q.student_code === p.student_code) !== idx
        );
        const invalid = parsed.filter(
          (p) => !p.student_code || !p.name || !LEVELS.includes(p.level) || !p.class_room
        );

        const messages = [];
        if (invalid.length > 0) {
          messages.push(
            `พบข้อมูลไม่ครบ ${invalid.length} แถว (แถวที่ ${invalid.map((v) => v.row).join(', ')}) — แถวเหล่านี้จะถูกข้ามตอนนำเข้า`
          );
        }
        if (duplicatesInFile.length > 0) {
          const codes = [...new Set(duplicatesInFile.map((d) => d.student_code))];
          messages.push(`พบรหัสนักเรียนซ้ำกันเองในไฟล์: ${codes.join(', ')} — แถวที่ซ้ำจะถูกนำเข้าเป็นคนล่าสุดที่เจอเท่านั้น`);
        }
        setColumnMap({
          code: headerRow[colCode] || `คอลัมน์ ${colCode + 1}`,
          name: headerRow[colName] || `คอลัมน์ ${colName + 1}`,
          level: headerRow[colLevel] || `คอลัมน์ ${colLevel + 1}`,
          room: headerRow[colRoom] || `คอลัมน์ ${colRoom + 1}`
        });
        setFileError(messages.join(' | '));
        setPreview(parsed);
      } catch (err) {
        setFileError('ไม่สามารถอ่านไฟล์นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx หรือ .csv ที่ถูกต้อง');
        setPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  async function confirmImport() {
    const valid = preview.filter((p) => p.student_code && p.name && LEVELS.includes(p.level) && p.class_room);
    const skipped = preview.length - valid.length;
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const existingCodes = new Map(students.map((s) => [s.student_code, s.id]));
      let added = 0;
      let updated = 0;
      for (const row of valid) {
        const payload = {
          student_code: row.student_code,
          name: row.name,
          level: row.level,
          class_room: row.class_room
        };
        if (existingCodes.has(row.student_code)) {
          await update(ref(db, `students/${existingCodes.get(row.student_code)}`), payload);
          updated += 1;
        } else {
          const newRef = push(ref(db, 'students'));
          await set(newRef, payload);
          existingCodes.set(row.student_code, newRef.key); // กันซ้ำถ้ามีรหัสเดียวกันอีกในไฟล์เดียวกัน
          added += 1;
        }
      }
      setImportResult({ added, updated, skipped });
      setPreview([]);
    } finally {
      setImporting(false);
    }
  }

  async function handleAddOne(e) {
    e.preventDefault();
    setAddMsg(null);
    const code = form.student_code.trim();
    const duplicate = students.some((s) => s.student_code === code);
    if (duplicate) {
      setAddMsg({ type: 'error', text: `รหัสนักเรียน "${code}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` });
      return;
    }
    await set(push(ref(db, 'students')), { ...form, student_code: code });
    setAddMsg({ type: 'success', text: `เพิ่ม "${form.name}" เรียบร้อยแล้ว` });
    setForm(EMPTY_FORM);
    // ล้างตัวกรองและกลับไปหน้าแรก เพื่อให้เห็นนักเรียนที่เพิ่งเพิ่มทันที (เผื่อโดนตัวกรองเดิมบัง)
    setLevelFilter('all');
    setRoomFilter('all');
    setSearch('');
    setPage(1);
    setTimeout(() => setAddMsg(null), 4000);
  }

  async function del(id) {
    if (confirm('ยืนยันการลบนักเรียนคนนี้?')) await remove(ref(db, `students/${id}`));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage(pageItems) {
    setSelectedIds((prev) => {
      const allSelected = pageItems.every((s) => prev.has(s.id));
      const next = new Set(prev);
      if (allSelected) {
        pageItems.forEach((s) => next.delete(s.id));
      } else {
        pageItems.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`ยืนยันการลบนักเรียนที่เลือกไว้ ${selectedIds.size} คน? การลบนี้ไม่สามารถย้อนกลับได้`)) return;
    await Promise.all([...selectedIds].map((id) => remove(ref(db, `students/${id}`))));
    setSelectedIds(new Set());
  }

  function downloadAllStudents() {
    const rows = students.map((s) => [s.student_code, s.name, s.level, s.class_room]);
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 8 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน');
    XLSX.writeFile(wb, `รายชื่อนักเรียนทั้งหมด_${students.length}คน.xlsx`);
  }

  const rooms = [...new Set(students.map((s) => s.class_room).filter(Boolean))].sort();

  const filtered = students.filter((s) => {
    if (levelFilter !== 'all' && s.level !== levelFilter) return false;
    if (roomFilter !== 'all' && s.class_room !== roomFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${s.student_code} ${s.name} ${s.level} ${s.class_room}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetToFirstPage(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="👥" title="จัดการนักเรียน" subtitle="นำเข้าด้วยไฟล์ Excel หรือเพิ่มทีละคน" />

        {loadError && (
          <div className="mx-6 mt-4 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-3">
            ⚠️ {loadError}
          </div>
        )}

        {debugInfo && (
          <div className="mx-6 mt-4 text-xs font-mono bg-slate-800 text-lime-300 rounded-lg px-4 py-3 space-y-0.5">
            <div>🔧 DEBUG — onValue (realtime): {debugInfo.onValueCount ?? '...'} คน (อัปเดตล่าสุด {debugInfo.onValueAt ?? '-'})</div>
            <div>🔧 DEBUG — get() ครั้งเดียว: {debugInfo.oneTimeGetCount ?? '...'} คน (ดึงเมื่อ {debugInfo.oneTimeGetAt ?? '-'})</div>
            <div>🔧 DEBUG — state ปัจจุบันที่ใช้แสดงผล (students.length): {students.length} คน</div>
            <div>🔧 DEBUG — หลังกรอง (filtered.length): {filtered.length} คน | หน้า {currentPage}/{totalPages}</div>
            {debugInfo.onValueError && <div className="text-red-400">🔧 onValue error: {debugInfo.onValueError}</div>}
            {debugInfo.oneTimeGetError && <div className="text-red-400">🔧 get() error: {debugInfo.oneTimeGetError}</div>}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* นำเข้าด้วย Excel */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">นำเข้ารายชื่อนักเรียนด้วยไฟล์ Excel</h3>
                <p className="text-xs text-slate-400 mt-1">
                  คอลัมน์ที่ต้องมี: รหัสนักเรียน, ชื่อ-นามสกุล, ชั้น (ม.1–ม.6), ห้อง (ตัวเลข เช่น 1, 2, 3) — แถวแรกเป็นหัวตาราง
                </p>
              </div>
              <button onClick={downloadTemplate} className="border border-primary text-primary px-4 py-2 rounded-lg text-sm hover:bg-blue-50 whitespace-nowrap">
                ⬇ ดาวน์โหลดไฟล์ตัวอย่าง
              </button>
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer hover:bg-slate-50">
              <span className="text-3xl mb-2">📤</span>
              <span className="text-sm text-slate-600">คลิกเพื่อเลือกไฟล์ .xlsx หรือ .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </label>

            {fileError && <div className="text-sm text-red-600 mt-3">{fileError}</div>}

            {importResult && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-3">
                นำเข้าสำเร็จ — เพิ่มใหม่ {importResult.added} คน, อัปเดตข้อมูลเดิม {importResult.updated} คน
                {importResult.skipped > 0 && `, ข้ามไป ${importResult.skipped} แถว (ข้อมูลไม่ครบ)`}
              </div>
            )}

            {preview.length > 0 && (
              <div className="mt-4">
                {columnMap && (
                  <div className="text-xs bg-slate-50 border rounded-lg px-3 py-2 mb-2 text-slate-500">
                    ระบบจับคู่คอลัมน์เป็น: รหัสนักเรียน = <strong>"{columnMap.code}"</strong>, ชื่อ-นามสกุล = <strong>"{columnMap.name}"</strong>,
                    ชั้น = <strong>"{columnMap.level}"</strong>, ห้อง = <strong>"{columnMap.room}"</strong> — ถ้าไม่ตรงกับไฟล์ของคุณ
                    ให้ยกเลิกแล้วแก้หัวตารางในไฟล์ Excel ให้ชัดเจนขึ้น (เช่น "รหัสนักเรียน", "ชื่อ-นามสกุล", "ชั้น", "ห้อง")
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">ตัวอย่างข้อมูลก่อนนำเข้า ({preview.length} แถว)</h4>
                  <div className="flex gap-2">
                    <button onClick={() => { setPreview([]); setFileError(''); setColumnMap(null); }} className="text-xs px-3 py-1.5 rounded-lg border">
                      ยกเลิก
                    </button>
                    <button
                      onClick={confirmImport}
                      disabled={importing}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-light disabled:opacity-60"
                    >
                      {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${preview.length} รายการ`}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-64 border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-400">
                        <th className="py-2 px-2">แถว</th>
                        <th className="py-2 px-2">รหัสนักเรียน</th>
                        <th className="py-2 px-2">ชื่อ-นามสกุล</th>
                        <th className="py-2 px-2">ชั้น</th>
                        <th className="py-2 px-2">ห้อง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((p) => {
                        const bad = !p.student_code || !p.name || !LEVELS.includes(p.level) || !p.class_room;
                        return (
                          <tr key={p.row} className={`border-t ${bad ? 'bg-red-50' : ''}`}>
                            <td className="py-1.5 px-2">{p.row}</td>
                            <td className="py-1.5 px-2">{p.student_code || '—'}</td>
                            <td className="py-1.5 px-2">{p.name || '—'}</td>
                            <td className="py-1.5 px-2">{p.level || '—'}</td>
                            <td className="py-1.5 px-2">{p.class_room || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* เพิ่มทีละคน */}
            <form onSubmit={handleAddOne} className="bg-white rounded-xl shadow p-5 space-y-3 h-fit">
              <h3 className="font-semibold text-slate-800">เพิ่มนักเรียนทีละคน</h3>
              <input required placeholder="รหัสนักเรียน" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.student_code} onChange={(e) => setForm({ ...form, student_code: e.target.value })} />
              <input required placeholder="ชื่อ-นามสกุล" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input required placeholder="ห้อง เช่น 1, 2, 3" type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.class_room} onChange={(e) => setForm({ ...form, class_room: e.target.value })} />
              {addMsg && (
                <div className={`text-sm rounded-lg px-3 py-2 ${
                  addMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {addMsg.type === 'success' ? '✅ ' : '⚠️ '}{addMsg.text}
                </div>
              )}
              <button className="w-full bg-primary text-white py-2 rounded-lg text-sm hover:bg-primary-light">เพิ่มนักเรียน</button>
            </form>

            {/* รายชื่อทั้งหมด */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800">
                  รายชื่อนักเรียนทั้งหมด ({filtered.length}{filtered.length !== students.length ? ` จาก ${students.length}` : ''})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={manualRefresh}
                    disabled={refreshing}
                    className="border px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                    title="ดึงข้อมูลล่าสุดจาก Firebase อีกครั้ง (เผื่อหน้าจอค้าง)"
                  >
                    {refreshing ? '⏳ กำลังรีเฟรช...' : '🔄 รีเฟรชข้อมูล'}
                  </button>
                  <button
                    onClick={downloadAllStudents}
                    disabled={students.length === 0}
                    className="border border-primary text-primary px-3 py-1.5 rounded-lg text-xs hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    ⬇ ดาวน์โหลดรายชื่อทั้งหมด (Excel)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  className="border rounded-lg px-3 py-1.5 text-sm"
                  value={levelFilter}
                  onChange={(e) => resetToFirstPage(setLevelFilter)(e.target.value)}
                >
                  <option value="all">ทุกระดับชั้น</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                  className="border rounded-lg px-3 py-1.5 text-sm"
                  value={roomFilter}
                  onChange={(e) => resetToFirstPage(setRoomFilter)(e.target.value)}
                >
                  <option value="all">ทุกห้อง</option>
                  {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input
                  className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                  placeholder="🔍 ค้นหา รหัส/ชื่อ/ชั้น/ห้อง"
                  value={search}
                  onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
                />
                {(levelFilter !== 'all' || roomFilter !== 'all' || search) && (
                  <button
                    onClick={() => { resetToFirstPage(setLevelFilter)('all'); setRoomFilter('all'); setSearch(''); }}
                    className="text-slate-400 hover:text-red-500 text-sm px-2"
                    title="ล้างตัวกรอง"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm">
                  <span className="text-red-700">เลือกไว้ {selectedIds.size} คน</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 hover:underline">ยกเลิกการเลือก</button>
                    <button onClick={bulkDelete} className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">
                      🗑 ลบที่เลือกทั้งหมด
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-2 pr-2 w-8">
                        <input
                          type="checkbox"
                          checked={pageItems.length > 0 && pageItems.every((s) => selectedIds.has(s.id))}
                          onChange={() => toggleSelectAllOnPage(pageItems)}
                        />
                      </th>
                      <th className="py-2 pr-2">รหัส</th>
                      <th className="py-2 pr-2">ชื่อ-นามสกุล</th>
                      <th className="py-2 pr-2">ชั้น</th>
                      <th className="py-2 pr-2">ห้อง</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">กำลังโหลดข้อมูล...</td></tr>
                    )}
                    {!loading && pageItems.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">ไม่พบข้อมูลนักเรียนตามเงื่อนไข</td></tr>
                    )}
                    {pageItems.map((s) => (
                      <tr key={s.id} className={`border-b last:border-0 hover:bg-slate-50 ${selectedIds.has(s.id) ? 'bg-lime-50' : ''}`}>
                        <td className="py-2 pr-2">
                          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                        </td>
                        <td className="py-2 pr-2">{s.student_code}</td>
                        <td className="py-2 pr-2">{s.name}</td>
                        <td className="py-2 pr-2">{s.level}</td>
                        <td className="py-2 pr-2">{s.class_room}</td>
                        <td className="py-2 pr-2 text-right">
                          <button onClick={() => del(s.id)} className="text-xs text-red-500 underline">ลบ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
                  <span>
                    แสดง {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} จาก {filtered.length} คน
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
                    >
                      ← ก่อนหน้า
                    </button>
                    <span className="px-2">หน้า {currentPage} / {totalPages}</span>
                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(currentPage + 1)}
                      className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
