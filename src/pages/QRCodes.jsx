import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { onValue, push, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { db } from '../firebase';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

const LEVEL_STYLES = {
  'ม.1': 'from-blue-500 to-blue-600',
  'ม.2': 'from-green-500 to-green-600',
  'ม.3': 'from-orange-400 to-orange-500',
  'ม.4': 'from-purple-500 to-purple-600',
  'ม.5': 'from-pink-500 to-rose-600',
  'ม.6': 'from-teal-600 to-cyan-700'
};

function urlFor(level) {
  // ใช้โดเมนของเว็บที่ deploy อยู่จริงเสมอ (ไม่ใช่ URL ตายตัวของเว็บอ้างอิงเดิม)
  return `${window.location.origin}/student-login?level=${encodeURIComponent(level)}`;
}

export default function QRCodes() {
  const [copied, setCopied] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [exams, setExams] = useState([]);
  const [customQrs, setCustomQrs] = useState([]);
  const [subjectModalLevel, setSubjectModalLevel] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQr, setNewQr] = useState({ level: 'ม.1', label: '' });

  useEffect(() => {
    const unsubExams = onValue(ref(db, 'exams'), (snap) => {
      const list = [];
      snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
      setExams(list);
    });
    const unsubQr = onValue(ref(db, 'qr_codes'), (snap) => {
      const list = [];
      snap.forEach((c) => list.push({ id: c.key, ...c.val() }));
      list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      setCustomQrs(list);
    });
    return () => { unsubExams(); unsubQr(); };
  }, []);

  async function copyUrl(key, url) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function openUrl(url) {
    window.open(url, '_blank');
  }

  function printCard(key, url) {
    const canvas = document.getElementById(`qr-${key}`);
    const w = window.open('', '_blank');
    w.document.write(`<img src="${canvas.toDataURL()}" style="width:300px"/><p style="font-family:sans-serif">${url}</p>`);
    w.document.close();
    w.print();
  }

  async function saveQr(level) {
    const qrRef = push(ref(db, 'qr_codes'));
    await set(qrRef, { level, url: urlFor(level), created_at: serverTimestamp() });
    setSavedAt(level);
    setTimeout(() => setSavedAt(null), 1500);
  }

  async function createCustomQr(e) {
    e.preventDefault();
    const qrRef = push(ref(db, 'qr_codes'));
    await set(qrRef, {
      level: newQr.level,
      label: newQr.label.trim() || `QR เพิ่มเติม ${newQr.level}`,
      url: urlFor(newQr.level),
      created_at: serverTimestamp()
    });
    setNewQr({ level: 'ม.1', label: '' });
    setShowCreateModal(false);
  }

  async function deleteCustomQr(id) {
    if (confirm('ยืนยันการลบ QR Code นี้?')) await remove(ref(db, `qr_codes/${id}`));
  }

  async function toggleExamStatus(exam) {
    await update(ref(db, `exams/${exam.id}`), { status: exam.status === 'open' ? 'closed' : 'open' });
  }

  const examsForModal = exams.filter((e) => e.level === subjectModalLevel);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <Topbar icon="🔲" title="QR Code สำหรับเข้าสอบแยกตามระดับชั้น" subtitle="ให้นักเรียนสแกน QR Code ของระดับตนเอง ระบบจะกรองข้อสอบให้ตรงกับระดับชั้นโดยอัตโนมัติ" />

        <div className="p-6">
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-light"
            >
              + สร้าง QR ใหม่
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {LEVELS.map((level, idx) => {
              const openCount = exams.filter((e) => e.level === level && e.status === 'open').length;
              const url = urlFor(level);
              return (
                <div key={level} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className={`bg-gradient-to-r ${LEVEL_STYLES[level]} text-white px-4 py-3 flex items-center justify-between`}>
                    <span className="font-semibold">🎓 ระดับชั้น {level}</span>
                    <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full">
                      {openCount > 0 ? `เปิดสอบ ${openCount} วิชา` : 'ยังไม่เปิดสอบ'}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col items-center">
                    <QRCodeCanvas id={`qr-${level}`} value={url} size={160} includeMargin />
                    <div className="text-xs text-slate-400 mt-2">QR {idx + 1}/6</div>
                    <div className="text-sm font-medium text-slate-700 mt-2">ลิงก์เข้าสอบ {level}</div>
                    <p className="text-xs text-slate-400 text-center mt-1">
                      สแกนแล้วระบบจะเลือกข้อสอบของ {level} โดยอัตโนมัติ
                    </p>
                    <div className="w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs text-slate-500 mt-3 truncate">
                      {url}
                    </div>

                    <button
                      onClick={() => setSubjectModalLevel(level)}
                      className="w-full mt-3 border border-primary text-primary rounded-lg py-1.5 text-xs hover:bg-blue-50"
                    >
                      📚 เลือกวิชาที่จะเปิดสอบ
                    </button>

                    <div className="grid grid-cols-4 gap-2 w-full mt-2 text-xs">
                      <button onClick={() => copyUrl(level, url)} className="border rounded-lg py-1.5 hover:bg-slate-50" title="คัดลอกลิงก์">
                        {copied === level ? '✓' : '📋'}
                      </button>
                      <button onClick={() => openUrl(url)} className="border rounded-lg py-1.5 hover:bg-slate-50" title="เปิดลิงก์">🔗</button>
                      <button onClick={() => printCard(level, url)} className="border rounded-lg py-1.5 hover:bg-slate-50" title="พิมพ์">🖨️</button>
                      <button onClick={() => saveQr(level)} className="border rounded-lg py-1.5 hover:bg-slate-50" title="บันทึกลงระบบ">
                        {savedAt === level ? '✓' : '💾'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* QR เพิ่มเติมที่สร้างเอง */}
          {customQrs.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-slate-700 mb-3">QR Code เพิ่มเติม</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {customQrs.map((qr) => (
                  <div key={qr.id} className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="bg-slate-700 text-white px-4 py-3 flex items-center justify-between">
                      <span className="font-semibold text-sm">🔖 {qr.label || qr.level}</span>
                      <button onClick={() => deleteCustomQr(qr.id)} className="text-white/70 hover:text-white text-xs">ลบ ✕</button>
                    </div>
                    <div className="p-4 flex flex-col items-center">
                      <QRCodeCanvas id={`qr-custom-${qr.id}`} value={qr.url} size={140} includeMargin />
                      <div className="w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs text-slate-500 mt-3 truncate">
                        {qr.url}
                      </div>
                      <div className="grid grid-cols-3 gap-2 w-full mt-3 text-xs">
                        <button onClick={() => copyUrl(qr.id, qr.url)} className="border rounded-lg py-1.5 hover:bg-slate-50">
                          {copied === qr.id ? '✓' : '📋'}
                        </button>
                        <button onClick={() => openUrl(qr.url)} className="border rounded-lg py-1.5 hover:bg-slate-50">🔗</button>
                        <button onClick={() => printCard(qr.id, qr.url)} className="border rounded-lg py-1.5 hover:bg-slate-50">🖨️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal: สร้าง QR ใหม่ */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowCreateModal(false)}>
            <form
              onSubmit={createCustomQr}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3"
            >
              <h3 className="font-semibold text-slate-800">สร้าง QR Code ใหม่</h3>
              <p className="text-xs text-slate-400">ใช้สำหรับกรณีพิเศษ เช่น ห้องสอบเสริม หรือรอบสอบซ่อม</p>
              <div>
                <label className="text-xs text-slate-500">ป้ายกำกับ (ไม่บังคับ)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="เช่น ม.1 ห้องสอบซ่อม"
                  value={newQr.label}
                  onChange={(e) => setNewQr({ ...newQr, label: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">ระดับชั้น</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  value={newQr.level}
                  onChange={(e) => setNewQr({ ...newQr, level: e.target.value })}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border rounded-lg py-2 text-sm">
                  ยกเลิก
                </button>
                <button className="flex-1 bg-primary text-white rounded-lg py-2 text-sm hover:bg-primary-light">
                  สร้าง QR
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal: เลือกวิชาที่จะเปิดสอบของระดับชั้น */}
        {subjectModalLevel && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setSubjectModalLevel(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-800">วิชาที่จะเปิดสอบ · {subjectModalLevel}</h3>
                <button onClick={() => setSubjectModalLevel(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                เปิด/ปิดวิชาที่ต้องการให้นักเรียนของระดับชั้นนี้เข้าสอบได้ผ่าน QR Code นี้
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {examsForModal.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    ยังไม่มีข้อสอบของระดับชั้นนี้ — ไปเพิ่มที่หน้า "จัดการข้อสอบ" ก่อน
                  </p>
                )}
                {examsForModal.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{exam.subject}</div>
                      <div className="text-xs text-slate-400">ห้อง {exam.room} · {exam.start_time}-{exam.end_time}</div>
                    </div>
                    <button
                      onClick={() => toggleExamStatus(exam)}
                      className={`relative w-11 h-6 rounded-full transition ${exam.status === 'open' ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${
                        exam.status === 'open' ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setSubjectModalLevel(null)} className="w-full mt-4 bg-primary text-white rounded-lg py-2 text-sm hover:bg-primary-light">
                เสร็จสิ้น
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
