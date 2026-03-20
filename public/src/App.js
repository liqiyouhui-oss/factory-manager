import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// MOCK DATA
// ============================================================
const MACHINES = ["旋盤", "中ぐり", "フライス", "NC旋盤", "ターニング"];
const PROCESSES = ["荒加工", "仕上げ加工"];
const STATUS_LIST = ["未着手", "進行中", "完了"];

const initialProducts = [
  { id: "P001", partNo: "A-2024-001", customer: "東芝機械", name: "主軸ハウジング", material: "S45C", qty: 5, dueDate: "2026-03-25" },
  { id: "P002", partNo: "B-2024-015", customer: "川崎重工", name: "ギアケース蓋", material: "FC250", qty: 12, dueDate: "2026-03-28" },
  { id: "P003", partNo: "C-2024-033", customer: "三菱電機", name: "モーターブラケット", material: "A5052", qty: 8, dueDate: "2026-04-05" },
  { id: "P004", partNo: "D-2024-044", customer: "住友重機", name: "フランジ", material: "SUS304", qty: 20, dueDate: "2026-03-22" },
  { id: "P005", partNo: "E-2024-052", customer: "ナブテスコ", name: "ケーシング", material: "FC300", qty: 3, dueDate: "2026-04-15" },
];

const initialProcesses = [
  { id: "PR001", productId: "P001", process: "荒加工", machine: "NC旋盤", operator: "田中", timePerUnit: 45 },
  { id: "PR002", productId: "P001", process: "仕上げ加工", machine: "旋盤", operator: "鈴木", timePerUnit: 60 },
  { id: "PR003", productId: "P002", process: "荒加工", machine: "フライス", operator: "佐藤", timePerUnit: 30 },
  { id: "PR004", productId: "P002", process: "仕上げ加工", machine: "中ぐり", operator: "田中", timePerUnit: 50 },
  { id: "PR005", productId: "P003", process: "荒加工", machine: "ターニング", operator: "高橋", timePerUnit: 35 },
  { id: "PR006", productId: "P003", process: "仕上げ加工", machine: "NC旋盤", operator: "鈴木", timePerUnit: 40 },
  { id: "PR007", productId: "P004", process: "荒加工", machine: "旋盤", operator: "山田", timePerUnit: 20 },
  { id: "PR008", productId: "P004", process: "仕上げ加工", machine: "旋盤", operator: "山田", timePerUnit: 25 },
  { id: "PR009", productId: "P005", process: "荒加工", machine: "中ぐり", operator: "佐藤", timePerUnit: 90 },
  { id: "PR010", productId: "P005", process: "仕上げ加工", machine: "フライス", operator: "高橋", timePerUnit: 120 },
];

const initialProgress = [
  { id: "PG001", productId: "P001", process: "荒加工", completed: 3, status: "進行中" },
  { id: "PG002", productId: "P001", process: "仕上げ加工", completed: 0, status: "未着手" },
  { id: "PG003", productId: "P002", process: "荒加工", completed: 12, status: "完了" },
  { id: "PG004", productId: "P002", process: "仕上げ加工", completed: 7, status: "進行中" },
  { id: "PG005", productId: "P003", process: "荒加工", completed: 2, status: "進行中" },
  { id: "PG006", productId: "P003", process: "仕上げ加工", completed: 0, status: "未着手" },
  { id: "PG007", productId: "P004", process: "荒加工", completed: 20, status: "完了" },
  { id: "PG008", productId: "P004", process: "仕上げ加工", completed: 20, status: "完了" },
  { id: "PG009", productId: "P005", process: "荒加工", completed: 0, status: "未着手" },
  { id: "PG010", productId: "P005", process: "仕上げ加工", completed: 0, status: "未着手" },
];

// ============================================================
// UTILITIES
// ============================================================
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function getRiskLevel(product, processes, progressList) {
  const days = daysUntil(product.dueDate);
  const procs = processes.filter((p) => p.productId === product.id);
  const progList = progressList.filter((p) => p.productId === product.id);

  let remainingMinutes = 0;
  procs.forEach((proc) => {
    const prog = progList.find((p) => p.process === proc.process);
    const done = prog ? prog.completed : 0;
    const remaining = Math.max(0, product.qty - done);
    remainingMinutes += remaining * proc.timePerUnit;
  });

  const workdayMinutes = days * 8 * 60;
  const ratio = workdayMinutes > 0 ? remainingMinutes / workdayMinutes : 999;

  if (days < 0) return { level: "danger", label: "期限超過", color: "#FF3B30", bg: "#FF3B3022" };
  if (days <= 2 || ratio > 0.9) return { level: "danger", label: "遅延リスク", color: "#FF3B30", bg: "#FF3B3022" };
  if (days <= 5 || ratio > 0.6) return { level: "warning", label: "注意", color: "#FF9500", bg: "#FF950022" };
  return { level: "safe", label: "余裕あり", color: "#30D158", bg: "#30D15822" };
}

function calcProgress(product, progressList) {
  const progList = progressList.filter((p) => p.productId === product.id);
  if (progList.length === 0) return 0;
  const totalCompleted = progList.reduce((s, p) => s + p.completed, 0);
  const totalNeeded = progList.length * product.qty;
  return totalNeeded > 0 ? Math.min(100, Math.round((totalCompleted / totalNeeded) * 100)) : 0;
}

function calcMachineLoad(machines, processes, products, progressList) {
  return machines.map((machine) => {
    const procs = processes.filter((p) => p.machine === machine);
    let totalMinutes = 0;
    let remainingMinutes = 0;
    procs.forEach((proc) => {
      const product = products.find((p) => p.id === proc.productId);
      if (!product) return;
      const prog = progressList.find((p) => p.productId === proc.productId && p.process === proc.process);
      const done = prog ? prog.completed : 0;
      const total = product.qty * proc.timePerUnit;
      const remaining = Math.max(0, (product.qty - done) * proc.timePerUnit);
      totalMinutes += total;
      remainingMinutes += remaining;
    });
    return { machine, totalMinutes, remainingMinutes, items: procs.length };
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================
// OCR MODAL
// ============================================================
function OcrModal({ onClose, onImport }) {
  const [step, setStep] = useState("upload"); // upload | extracting | review
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [extractedData, setExtractedData] = useState([]);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const fileRef = useRef();
  const cameraRef = useRef();

  // ファイル選択 or カメラ撮影、どちらも共通処理
  const loadImageFile = (file) => {
    if (!file) return;
    // 対応MIMEタイプ: jpeg / png / gif / webp のみ Claude Vision が受け付ける
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const mime = allowed.includes(file.type) ? file.type : "image/jpeg";
    setImageMime(mime);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      // data:image/xxx;base64, の後ろだけ取り出す
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => loadImageFile(e.target.files[0]);
  const handleCameraInput = (e) => loadImageFile(e.target.files[0]);

  const handleExtract = async () => {
    if (!imageBase64) return;
    setStep("extracting");
    setError("");
    setErrorDetail("");
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageMime,  // ← 実際のMIMEを使用
                  data: imageBase64
                }
              },
              {
                type: "text",
                text: `この工程管理表・作業指示書・納期一覧などの画像を読み取り、製品情報を抽出してください。

必ずJSON配列のみを返してください（説明文・マークダウン不要）：
[{"partNo":"品番","customer":"客先名","name":"製品名","material":"材質","qty":数量の整数,"dueDate":"YYYY-MM-DD"}]

- 日付が「MM/DD」形式なら今年を補完してください
- 読み取れない項目は空文字 "" にしてください
- 数量が不明な場合は 1 にしてください
- 製品が複数行あれば全行を配列に含めてください
- 工程表でない画像・読み取れない場合は [] を返してください`
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errJson?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "[]";
      const clean = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) throw new Error("配列形式で返ってきませんでした");
      setExtractedData(parsed.map(r => ({ ...r, id: uid(), qty: Number(r.qty) || 1 })));
      setStep("review");
    } catch (err) {
      setError("解析に失敗しました。内容を確認して手動修正してください。");
      setErrorDetail(err.message || "");
      setExtractedData([{ id: uid(), partNo: "", customer: "", name: "", material: "", qty: 1, dueDate: "" }]);
      setStep("review");
    }
  };

  const handleAddRow = () => {
    setExtractedData(prev => [...prev, { id: uid(), partNo: "", customer: "", name: "", material: "", qty: 1, dueDate: "" }]);
  };

  const handleChange = (id, field, value) => {
    setExtractedData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemove = (id) => {
    setExtractedData(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: "12px", width: "100%", maxWidth: "760px", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #2A2A2A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#FF6B00", fontWeight: 700, fontSize: "16px", fontFamily: "monospace" }}>■ OCR取込</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "24px" }}>
          {step === "upload" && (
            <div>
              {/* プレビューエリア */}
              <div style={{ border: "2px dashed #333", borderRadius: "8px", minHeight: "180px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", overflow: "hidden" }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ maxWidth: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "4px" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "#555", padding: "32px" }}>
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>🖼️</div>
                    <div style={{ fontSize: "13px" }}>下のボタンで画像を選択してください</div>
                  </div>
                )}
              </div>

              {/* hidden inputs */}
              {/* カメラ直接起動 (スマホ) */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraInput}
                style={{ display: "none" }}
              />
              {/* ファイル選択 (既存の写真・PC) */}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />

              {/* ボタン群 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <button
                  onClick={() => cameraRef.current.click()}
                  style={{ background: "#1A1A1A", border: "1px solid #444", color: "#ccc", borderRadius: "8px", padding: "14px 8px", cursor: "pointer", fontSize: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
                >
                  <span style={{ fontSize: "24px" }}>📷</span>
                  <span style={{ fontSize: "12px" }}>カメラで撮影</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>スマホ向け</span>
                </button>
                <button
                  onClick={() => fileRef.current.click()}
                  style={{ background: "#1A1A1A", border: "1px solid #444", color: "#ccc", borderRadius: "8px", padding: "14px 8px", cursor: "pointer", fontSize: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
                >
                  <span style={{ fontSize: "24px" }}>🗂️</span>
                  <span style={{ fontSize: "12px" }}>ファイルを選択</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>既存の写真・PC</span>
                </button>
              </div>

              {imagePreview && (
                <button onClick={handleExtract} style={{ width: "100%", background: "#FF6B00", color: "#fff", border: "none", borderRadius: "8px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", marginBottom: "10px" }}>
                  ⚙️ AIで解析する
                </button>
              )}

              <div style={{ textAlign: "center" }}>
                <button onClick={() => { setExtractedData([{ id: uid(), partNo: "", customer: "", name: "", material: "", qty: 1, dueDate: "" }]); setStep("review"); }}
                  style={{ background: "none", border: "1px solid #333", color: "#666", borderRadius: "6px", padding: "8px 20px", cursor: "pointer", fontSize: "12px" }}>
                  手動で入力する
                </button>
              </div>

              <div style={{ marginTop: "16px", background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "10px 14px" }}>
                <div style={{ color: "#555", fontSize: "11px", lineHeight: "1.6" }}>
                  💡 <strong style={{ color: "#666" }}>撮影のコツ：</strong>表全体が入るよう真上から撮影し、文字がはっきり見えるようにしてください。JPG / PNG / WEBP に対応しています。
                </div>
              </div>
            </div>
          )}

          {step === "extracting" && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", animation: "spin 1s linear infinite" }}>⚙️</div>
              <div style={{ color: "#FF6B00", fontWeight: 700 }}>AIが工程表を解析中...</div>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          )}

          {step === "review" && (
            <div>
              {error && (
                <div style={{ background: "#FF3B3022", border: "1px solid #FF3B30", color: "#FF3B30", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px" }}>
                  {error}
                  {errorDetail && <div style={{ color: "#FF3B3099", fontSize: "11px", marginTop: "4px", fontFamily: "monospace" }}>{errorDetail}</div>}
                </div>
              )}
              <div style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>抽出結果を確認・修正してください</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#111" }}>
                      {["品番", "客先", "製品名", "材質", "数量", "納期", ""].map(h => (
                        <th key={h} style={{ padding: "8px 10px", color: "#FF6B00", fontWeight: 700, textAlign: "left", borderBottom: "1px solid #2A2A2A", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.map(row => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #1E1E1E" }}>
                        {["partNo", "customer", "name", "material"].map(f => (
                          <td key={f} style={{ padding: "6px 4px" }}>
                            <input value={row[f]} onChange={e => handleChange(row.id, f, e.target.value)}
                              style={{ background: "#222", border: "1px solid #333", color: "#eee", borderRadius: "4px", padding: "4px 8px", width: "100%", fontSize: "12px" }} />
                          </td>
                        ))}
                        <td style={{ padding: "6px 4px" }}>
                          <input type="number" value={row.qty} onChange={e => handleChange(row.id, "qty", parseInt(e.target.value) || 1)}
                            style={{ background: "#222", border: "1px solid #333", color: "#eee", borderRadius: "4px", padding: "4px 8px", width: "60px", fontSize: "12px" }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <input type="date" value={row.dueDate} onChange={e => handleChange(row.id, "dueDate", e.target.value)}
                            style={{ background: "#222", border: "1px solid #333", color: "#eee", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <button onClick={() => handleRemove(row.id)} style={{ background: "none", border: "none", color: "#FF3B30", cursor: "pointer", fontSize: "16px" }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={handleAddRow} style={{ flex: 1, background: "#222", border: "1px solid #444", color: "#888", borderRadius: "6px", padding: "10px", cursor: "pointer", fontSize: "13px" }}>
                  ＋ 行を追加
                </button>
                <button onClick={() => onImport(extractedData)} style={{ flex: 2, background: "#FF6B00", border: "none", color: "#fff", borderRadius: "6px", padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}>
                  取り込む ({extractedData.length}件)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT EDIT MODAL
// ============================================================
function ProductModal({ product, processes, progressList, onClose, onSave }) {
  const isNew = !product.id;
  const [form, setForm] = useState(product.id ? { ...product } : { id: uid(), partNo: "", customer: "", name: "", material: "", qty: 1, dueDate: "" });
  const [procs, setProcs] = useState(
    isNew ? PROCESSES.map((p, i) => ({ id: uid(), productId: form.id, process: p, machine: MACHINES[0], operator: "", timePerUnit: 30 }))
      : PROCESSES.map(p => {
        const existing = processes.find(pr => pr.productId === product.id && pr.process === p);
        return existing || { id: uid(), productId: product.id, process: p, machine: MACHINES[0], operator: "", timePerUnit: 30 };
      })
  );
  const [prog, setProg] = useState(
    isNew ? PROCESSES.map(p => ({ id: uid(), productId: form.id, process: p, completed: 0, status: "未着手" }))
      : PROCESSES.map(p => {
        const existing = progressList.find(pg => pg.productId === product.id && pg.process === p);
        return existing || { id: uid(), productId: product.id, process: p, completed: 0, status: "未着手" };
      })
  );

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setP = (proc, k, v) => setProcs(prev => prev.map(p => p.process === proc ? { ...p, [k]: v } : p));
  const setPg = (proc, k, v) => setProg(prev => prev.map(p => p.process === proc ? { ...p, [k]: v } : p));

  const handleSave = () => {
    if (!form.partNo || !form.dueDate) return;
    onSave(form, procs, prog);
    onClose();
  };

  const inputStyle = { background: "#111", border: "1px solid #333", color: "#eee", borderRadius: "6px", padding: "8px 12px", width: "100%", fontSize: "14px", boxSizing: "border-box" };
  const labelStyle = { color: "#888", fontSize: "12px", marginBottom: "4px", display: "block", fontFamily: "monospace" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: "12px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #2A2A2A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#FF6B00", fontWeight: 700, fontFamily: "monospace" }}>■ {isNew ? "製品追加" : "製品編集"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label style={labelStyle}>品番 *</label><input style={inputStyle} value={form.partNo} onChange={e => setF("partNo", e.target.value)} /></div>
            <div><label style={labelStyle}>客先</label><input style={inputStyle} value={form.customer} onChange={e => setF("customer", e.target.value)} /></div>
            <div><label style={labelStyle}>製品名</label><input style={inputStyle} value={form.name} onChange={e => setF("name", e.target.value)} /></div>
            <div><label style={labelStyle}>材質</label><input style={inputStyle} value={form.material} onChange={e => setF("material", e.target.value)} /></div>
            <div><label style={labelStyle}>数量</label><input type="number" style={inputStyle} value={form.qty} onChange={e => setF("qty", parseInt(e.target.value) || 1)} /></div>
            <div><label style={labelStyle}>納期 *</label><input type="date" style={inputStyle} value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} /></div>
          </div>

          {PROCESSES.map(proc => {
            const pr = procs.find(p => p.process === proc);
            const pg = prog.find(p => p.process === proc);
            return (
              <div key={proc} style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "16px" }}>
                <div style={{ color: "#FF6B00", fontWeight: 700, fontSize: "13px", fontFamily: "monospace", marginBottom: "12px" }}>▶ {proc}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>担当機械</label>
                    <select style={{ ...inputStyle }} value={pr.machine} onChange={e => setP(proc, "machine", e.target.value)}>
                      {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>担当者</label><input style={inputStyle} value={pr.operator} onChange={e => setP(proc, "operator", e.target.value)} /></div>
                  <div><label style={labelStyle}>加工時間/個 (分)</label><input type="number" style={inputStyle} value={pr.timePerUnit} onChange={e => setP(proc, "timePerUnit", parseInt(e.target.value) || 1)} /></div>
                  <div>
                    <label style={labelStyle}>ステータス</label>
                    <select style={{ ...inputStyle }} value={pg.status} onChange={e => setPg(proc, "status", e.target.value)}>
                      {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>完了数</label><input type="number" style={inputStyle} value={pg.completed} onChange={e => setPg(proc, "completed", parseInt(e.target.value) || 0)} /></div>
                </div>
              </div>
            );
          })}

          <button onClick={handleSave} style={{ background: "#FF6B00", border: "none", color: "#fff", borderRadius: "8px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", marginTop: "4px" }}>
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ products, processes, progressList }) {
  const machineLoad = calcMachineLoad(MACHINES, processes, products, progressList);
  const maxLoad = Math.max(...machineLoad.map(m => m.remainingMinutes), 1);
  const bottleneck = machineLoad.reduce((a, b) => b.remainingMinutes > a.remainingMinutes ? b : a, machineLoad[0]);

  const riskCounts = { safe: 0, warning: 0, danger: 0 };
  products.forEach(p => {
    const risk = getRiskLevel(p, processes, progressList);
    riskCounts[risk.level]++;
  });

  const overallProgress = products.length > 0
    ? Math.round(products.reduce((s, p) => s + calcProgress(p, progressList), 0) / products.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
        {[
          { label: "総案件数", value: products.length, color: "#eee", icon: "📦" },
          { label: "遅延リスク", value: riskCounts.danger, color: "#FF3B30", icon: "🔴" },
          { label: "注意", value: riskCounts.warning, color: "#FF9500", icon: "🟡" },
          { label: "総合進捗", value: `${overallProgress}%`, color: "#30D158", icon: "📊" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>{kpi.icon}</div>
            <div style={{ color: kpi.color, fontSize: "28px", fontWeight: 900, fontFamily: "monospace" }}>{kpi.value}</div>
            <div style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Bottleneck Alert */}
      {bottleneck && bottleneck.remainingMinutes > 0 && (
        <div style={{ background: "#FF6B0015", border: "1px solid #FF6B00", borderRadius: "10px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <div style={{ color: "#FF6B00", fontWeight: 700, fontSize: "13px", fontFamily: "monospace" }}>ボトルネック検出</div>
            <div style={{ color: "#ccc", fontSize: "14px", marginTop: "2px" }}>
              <strong style={{ color: "#FF6B00" }}>{bottleneck.machine}</strong> に最大負荷が集中 — 残り {Math.round(bottleneck.remainingMinutes / 60)}h ({bottleneck.items}工程)
            </div>
          </div>
        </div>
      )}

      {/* Machine Load */}
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "10px", padding: "20px" }}>
        <div style={{ color: "#FF6B00", fontWeight: 700, fontFamily: "monospace", fontSize: "13px", marginBottom: "16px" }}>■ 機械別負荷</div>
        {machineLoad.map(m => {
          const pct = maxLoad > 0 ? (m.remainingMinutes / maxLoad) * 100 : 0;
          const barColor = pct > 80 ? "#FF3B30" : pct > 50 ? "#FF9500" : "#30D158";
          return (
            <div key={m.machine} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ color: "#ccc", fontSize: "13px", fontFamily: "monospace" }}>{m.machine}</span>
                <span style={{ color: "#888", fontSize: "12px" }}>{Math.round(m.remainingMinutes / 60)}h 残</span>
              </div>
              <div style={{ background: "#111", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: "4px", transition: "width .6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Progress Overview */}
      <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: "10px", padding: "20px" }}>
        <div style={{ color: "#FF6B00", fontWeight: 700, fontFamily: "monospace", fontSize: "13px", marginBottom: "16px" }}>■ 製品別進捗</div>
        {products.slice(0, 5).map(p => {
          const risk = getRiskLevel(p, processes, progressList);
          const prog = calcProgress(p, progressList);
          const days = daysUntil(p.dueDate);
          return (
            <div key={p.id} style={{ marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid #1E1E1E" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", gap: "8px" }}>
                <div>
                  <span style={{ color: "#eee", fontSize: "13px", fontWeight: 600 }}>{p.name || p.partNo}</span>
                  <span style={{ color: "#555", fontSize: "11px", marginLeft: "8px" }}>{p.customer}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ background: risk.bg, color: risk.color, fontSize: "11px", padding: "2px 8px", borderRadius: "20px", fontWeight: 700, border: `1px solid ${risk.color}40` }}>{risk.label}</span>
                  <span style={{ color: "#555", fontSize: "11px" }}>{days >= 0 ? `残${days}日` : `${Math.abs(days)}日超過`}</span>
                </div>
              </div>
              <div style={{ background: "#111", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                <div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? "#30D158" : "#FF6B00", borderRadius: "4px", transition: "width .6s ease" }} />
              </div>
              <div style={{ color: "#555", fontSize: "11px", marginTop: "4px", textAlign: "right" }}>{prog}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCT LIST
// ============================================================
function ProductList({ products, processes, progressList, onEdit, onDelete, onAdd }) {
  const [filter, setFilter] = useState("all");

  const filtered = products.filter(p => {
    if (filter === "all") return true;
    return getRiskLevel(p, processes, progressList).level === filter;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[["all", "すべて", "#eee"], ["danger", "リスクあり", "#FF3B30"], ["warning", "注意", "#FF9500"], ["safe", "余裕", "#30D158"]].map(([val, label, color]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ background: filter === val ? color + "22" : "#1A1A1A", border: `1px solid ${filter === val ? color : "#333"}`, color: filter === val ? color : "#888", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontWeight: filter === val ? 700 : 400 }}>
            {label}
          </button>
        ))}
        <button onClick={onAdd} style={{ marginLeft: "auto", background: "#FF6B00", border: "none", color: "#fff", borderRadius: "6px", padding: "6px 16px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
          ＋ 追加
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(p => {
          const risk = getRiskLevel(p, processes, progressList);
          const prog = calcProgress(p, progressList);
          const days = daysUntil(p.dueDate);
          const procList = processes.filter(pr => pr.productId === p.id);
          const progList = progressList.filter(pg => pg.productId === p.id);

          return (
            <div key={p.id} style={{ background: "#1A1A1A", border: `1px solid ${risk.level === "danger" ? "#FF3B3040" : "#2A2A2A"}`, borderRadius: "10px", padding: "16px", borderLeft: `3px solid ${risk.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ color: "#eee", fontWeight: 700, fontSize: "15px" }}>{p.name || "—"}</span>
                    <span style={{ background: risk.bg, color: risk.color, fontSize: "11px", padding: "2px 8px", borderRadius: "20px", fontWeight: 700, border: `1px solid ${risk.color}40` }}>{risk.label}</span>
                  </div>
                  <div style={{ color: "#666", fontSize: "12px", marginTop: "3px", fontFamily: "monospace" }}>
                    {p.partNo} ｜ {p.customer} ｜ {p.material} ｜ {p.qty}個 ｜ 納期 {p.dueDate} ({days >= 0 ? `残${days}日` : `${Math.abs(days)}日超過`})
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button onClick={() => onEdit(p)} style={{ background: "#222", border: "1px solid #444", color: "#ccc", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", fontSize: "12px" }}>編集</button>
                  <button onClick={() => onDelete(p.id)} style={{ background: "none", border: "1px solid #FF3B3044", color: "#FF3B30", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}>削除</button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#666", fontSize: "11px" }}>総合進捗</span>
                  <span style={{ color: prog === 100 ? "#30D158" : "#FF6B00", fontWeight: 700, fontSize: "12px", fontFamily: "monospace" }}>{prog}%</span>
                </div>
                <div style={{ background: "#111", borderRadius: "4px", height: "6px" }}>
                  <div style={{ width: `${prog}%`, height: "100%", background: prog === 100 ? "#30D158" : "#FF6B00", borderRadius: "4px" }} />
                </div>
              </div>

              {/* Per-process status */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {PROCESSES.map(proc => {
                  const pr = procList.find(r => r.process === proc);
                  const pg = progList.find(r => r.process === proc);
                  const statusColor = pg?.status === "完了" ? "#30D158" : pg?.status === "進行中" ? "#FF6B00" : "#555";
                  return (
                    <div key={proc} style={{ background: "#111", border: "1px solid #222", borderRadius: "6px", padding: "6px 10px", fontSize: "11px" }}>
                      <span style={{ color: "#666" }}>{proc}: </span>
                      <span style={{ color: statusColor, fontWeight: 700 }}>{pg?.status || "未着手"}</span>
                      {pr && <span style={{ color: "#444", marginLeft: "6px" }}>{pr.machine}</span>}
                      {pg && p.qty > 0 && <span style={{ color: "#555", marginLeft: "6px" }}>{pg.completed}/{p.qty}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#444", fontSize: "14px" }}>
            該当する製品がありません
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CSV EXPORT
// ============================================================
function exportCSV(products, processes, progressList) {
  const rows = [["品番", "客先", "製品名", "材質", "数量", "納期", "工程", "機械", "担当者", "完了数", "ステータス", "進捗%"]];
  products.forEach(p => {
    PROCESSES.forEach(proc => {
      const pr = processes.find(r => r.productId === p.id && r.process === proc);
      const pg = progressList.find(r => r.productId === p.id && r.process === proc);
      rows.push([p.partNo, p.customer, p.name, p.material, p.qty, p.dueDate, proc, pr?.machine || "", pr?.operator || "", pg?.completed || 0, pg?.status || "未着手", calcProgress(p, progressList)]);
    });
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `工程管理_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [products, setProducts] = useState(initialProducts);
  const [processes, setProcesses] = useState(initialProcesses);
  const [progressList, setProgressList] = useState(initialProgress);
  const [tab, setTab] = useState("dashboard");
  const [showOcr, setShowOcr] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const handleSaveProduct = (prod, procs, prog) => {
    setProducts(prev => {
      const exists = prev.find(p => p.id === prod.id);
      return exists ? prev.map(p => p.id === prod.id ? prod : p) : [...prev, prod];
    });
    procs.forEach(pr => {
      setProcesses(prev => {
        const exists = prev.find(p => p.id === pr.id);
        return exists ? prev.map(p => p.id === pr.id ? pr : p) : [...prev, pr];
      });
    });
    prog.forEach(pg => {
      setProgressList(prev => {
        const exists = prev.find(p => p.id === pg.id);
        return exists ? prev.map(p => p.id === pg.id ? pg : p) : [...prev, pg];
      });
    });
  };

  const handleDeleteProduct = (id) => {
    if (!window.confirm("削除しますか？")) return;
    setProducts(prev => prev.filter(p => p.id !== id));
    setProcesses(prev => prev.filter(p => p.productId !== id));
    setProgressList(prev => prev.filter(p => p.productId !== id));
  };

  const handleOcrImport = (rows) => {
    rows.forEach(row => {
      const prod = { ...row, id: row.id || uid() };
      const procs = PROCESSES.map(p => ({ id: uid(), productId: prod.id, process: p, machine: MACHINES[0], operator: "", timePerUnit: 30 }));
      const prog = PROCESSES.map(p => ({ id: uid(), productId: prod.id, process: p, completed: 0, status: "未着手" }));
      setProducts(prev => [...prev, prod]);
      setProcesses(prev => [...prev, ...procs]);
      setProgressList(prev => [...prev, ...prog]);
    });
    setShowOcr(false);
  };

  const tabs = [
    { id: "dashboard", label: "📊 ダッシュボード" },
    { id: "products", label: "📦 案件一覧" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", color: "#eee", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { outline: none; }
        input:focus, select:focus { border-color: #FF6B00 !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 6px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1E1E1E", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#FF6B00", fontSize: "18px", fontWeight: 900, fontFamily: "monospace", letterSpacing: "-0.5px" }}>⚙ FACTORY</span>
              <span style={{ color: "#333", fontWeight: 300 }}>|</span>
              <span style={{ color: "#555", fontSize: "12px", fontFamily: "monospace" }}>工程管理</span>
            </div>
            <div className="header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                style={{ background: "#1A1A1A", border: "1px solid #333", color: "#aaa", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", fontFamily: "monospace" }} />
              <button onClick={() => setShowOcr(true)} style={{ background: "#1A1A1A", border: "1px solid #FF6B0080", color: "#FF6B00", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                📷 OCR取込
              </button>
              <button onClick={() => exportCSV(products, processes, progressList)} style={{ background: "#1A1A1A", border: "1px solid #444", color: "#888", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" }}>
                📥 CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div style={{ background: "#111", borderBottom: "1px solid #1E1E1E" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 16px", display: "flex", gap: "0" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "#FF6B00" : "transparent"}`, color: tab === t.id ? "#FF6B00" : "#666", padding: "10px 16px", cursor: "pointer", fontSize: "13px", fontWeight: tab === t.id ? 700 : 400, transition: "all .2s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "20px 16px" }}>
        {tab === "dashboard" && <Dashboard products={products} processes={processes} progressList={progressList} />}
        {tab === "products" && (
          <ProductList
            products={products} processes={processes} progressList={progressList}
            onEdit={p => setEditProduct(p)}
            onDelete={handleDeleteProduct}
            onAdd={() => setEditProduct({})}
          />
        )}
      </div>

      {/* Modals */}
      {showOcr && <OcrModal onClose={() => setShowOcr(false)} onImport={handleOcrImport} />}
      {editProduct && (
        <ProductModal
          product={editProduct}
          processes={processes}
          progressList={progressList}
          onClose={() => setEditProduct(null)}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
