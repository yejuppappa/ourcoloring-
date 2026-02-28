import { useState, useEffect, useCallback } from "react";
import type { DrawingWithMeta, Category, Subcategory } from "@/lib/db/types";

type Tab = "upload" | "manage" | "categories";

interface AdminState {
  authenticated: boolean;
  password: string;
  tab: Tab;
  categories: Category[];
  subcategories: Subcategory[];
  drawings: DrawingWithMeta[];
  total: number;
  page: number;
  search: string;
  filterSubcategory: string;
  loading: boolean;
  error: string;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/admin/${path}`, {
    ...opts,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function AdminApp() {
  const [state, setState] = useState<AdminState>({
    authenticated: false,
    password: "",
    tab: "upload",
    categories: [],
    subcategories: [],
    drawings: [],
    total: 0,
    page: 1,
    search: "",
    filterSubcategory: "",
    loading: false,
    error: "",
  });

  const set = (patch: Partial<AdminState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // ── Auth ──
  const handleLogin = async () => {
    set({ loading: true, error: "" });
    try {
      await api("auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: state.password }),
      });
      set({ authenticated: true, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  };

  // Check existing session
  useEffect(() => {
    api("auth")
      .then(() => set({ authenticated: true }))
      .catch(() => {});
  }, []);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!state.authenticated) return;
    set({ loading: true });
    try {
      const [cats, subcats] = await Promise.all([
        api("categories"),
        api("categories?subcategories=true"),
      ]);
      set({
        categories: cats.categories,
        subcategories: subcats.subcategories || [],
      });
    } catch (e: any) {
      set({ error: e.message });
    }
    set({ loading: false });
  }, [state.authenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDrawings = useCallback(async () => {
    if (!state.authenticated) return;
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        limit: "20",
      });
      if (state.search) params.set("search", state.search);
      if (state.filterSubcategory)
        params.set("subcategory", state.filterSubcategory);

      const data = await api(`drawings?${params}`);
      set({ drawings: data.drawings, total: data.total });
    } catch (e: any) {
      set({ error: e.message });
    }
  }, [state.authenticated, state.page, state.search, state.filterSubcategory]);

  useEffect(() => {
    if (state.tab === "manage") loadDrawings();
  }, [state.tab, loadDrawings]);

  // ── Login Screen ──
  if (!state.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-6">
            OurColoring Admin
          </h1>
          {state.error && (
            <p className="text-red-500 text-sm mb-4">{state.error}</p>
          )}
          <input
            type="password"
            placeholder="비밀번호"
            value={state.password}
            onChange={(e) => set({ password: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 mb-4"
            autoFocus
          />
          <button
            onClick={handleLogin}
            disabled={state.loading}
            className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {state.loading ? "..." : "로그인"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">OurColoring Admin</h1>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-900">
            사이트로 이동
          </a>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex gap-0">
          {(["upload", "manage", "categories"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => set({ tab })}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                state.tab === tab
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "upload"
                ? "도안 업로드"
                : tab === "manage"
                  ? "도안 관리"
                  : "카테고리"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-4">
        {state.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {state.error}
            <button onClick={() => set({ error: "" })} className="ml-2 underline">
              닫기
            </button>
          </div>
        )}

        {state.tab === "upload" && (
          <UploadTab
            subcategories={state.subcategories}
            categories={state.categories}
            onSuccess={() => {
              set({ tab: "manage" });
              loadDrawings();
            }}
          />
        )}

        {state.tab === "manage" && (
          <ManageTab
            drawings={state.drawings}
            total={state.total}
            page={state.page}
            search={state.search}
            filterSubcategory={state.filterSubcategory}
            subcategories={state.subcategories}
            categories={state.categories}
            onSearch={(s) => set({ search: s, page: 1 })}
            onFilter={(f) => set({ filterSubcategory: f, page: 1 })}
            onPage={(p) => set({ page: p })}
            onRefresh={loadDrawings}
          />
        )}

        {state.tab === "categories" && (
          <CategoriesTab
            categories={state.categories}
            subcategories={state.subcategories}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
}

// ═══ Upload Tab ═══
function UploadTab({
  subcategories,
  categories,
  onSuccess,
}: {
  subcategories: Subcategory[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    subcategory_id: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    age_min: 3,
    age_max: 10,
    name_ko: "",
    name_en: "",
    description_ko: "",
    description_en: "",
  });
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length || !form.subcategory_id) {
      setMessage("파일과 서브카테고리를 선택해주세요.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("subcategory_id", form.subcategory_id);
        formData.append("difficulty", form.difficulty);
        formData.append("age_min", String(form.age_min));
        formData.append("age_max", String(form.age_max));

        // Use filename as name if not specified
        const baseName = file.name.replace(/\.[^.]+$/, "");
        formData.append("name_ko", form.name_ko || baseName);
        formData.append("name_en", form.name_en || baseName);
        formData.append("description_ko", form.description_ko);
        formData.append("description_en", form.description_en);

        await fetch("/api/admin/drawings", {
          method: "POST",
          credentials: "include",
          body: formData,
        }).then((r) => {
          if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
          return r.json();
        });
      }
      setMessage(`${files.length}개 도안 업로드 완료!`);
      setFiles([]);
      setTimeout(onSuccess, 1000);
    } catch (e: any) {
      setMessage(`오류: ${e.message}`);
    }
    setUploading(false);
  };

  // Group subcategories by category
  const grouped = categories.map((cat) => ({
    ...cat,
    subcats: subcategories.filter((s) => s.category_id === cat.id),
  }));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold">도안 업로드</h2>

      {/* File input */}
      <div>
        <label className="block text-sm font-medium mb-2">이미지 파일</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-600 hover:file:bg-orange-100"
        />
        {files.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">{files.length}개 파일 선택됨</p>
        )}
      </div>

      {/* Subcategory */}
      <div>
        <label className="block text-sm font-medium mb-2">서브카테고리</label>
        <select
          value={form.subcategory_id}
          onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          required
        >
          <option value="">선택...</option>
          {grouped.map((cat) => (
            <optgroup key={cat.id} label={`${cat.icon} ${cat.name_ko}`}>
              {cat.subcats.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name_ko}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Difficulty + Age */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">난이도</label>
          <select
            value={form.difficulty}
            onChange={(e) =>
              setForm({ ...form, difficulty: e.target.value as any })
            }
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          >
            <option value="easy">쉬움 (4~6세)</option>
            <option value="medium">보통 (7~9세)</option>
            <option value="hard">어려움 (10세+)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">추천 연령</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="15"
              value={form.age_min}
              onChange={(e) => setForm({ ...form, age_min: +e.target.value })}
              className="w-20 rounded-lg border border-gray-300 px-3 py-2.5"
            />
            <span>~</span>
            <input
              type="number"
              min="1"
              max="15"
              value={form.age_max}
              onChange={(e) => setForm({ ...form, age_max: +e.target.value })}
              className="w-20 rounded-lg border border-gray-300 px-3 py-2.5"
            />
            <span className="text-sm text-gray-500">세</span>
          </div>
        </div>
      </div>

      {/* Names */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">이름 (한국어)</label>
          <input
            type="text"
            value={form.name_ko}
            onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
            placeholder="비워두면 파일명 사용"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">이름 (영어)</label>
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            placeholder="비워두면 파일명 사용"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          />
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">설명 (한국어)</label>
          <textarea
            value={form.description_ko}
            onChange={(e) => setForm({ ...form, description_ko: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">설명 (영어)</label>
          <textarea
            value={form.description_en}
            onChange={(e) => setForm({ ...form, description_en: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
          />
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${message.startsWith("오류") ? "text-red-500" : "text-green-600"}`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || files.length === 0}
        className="rounded-lg bg-orange-500 px-8 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {uploading ? "업로드 중..." : `업로드 (${files.length}개)`}
      </button>
    </form>
  );
}

// ═══ Manage Tab ═══
function ManageTab({
  drawings,
  total,
  page,
  search,
  filterSubcategory,
  subcategories,
  categories,
  onSearch,
  onFilter,
  onPage,
  onRefresh,
}: {
  drawings: DrawingWithMeta[];
  total: number;
  page: number;
  search: string;
  filterSubcategory: string;
  subcategories: Subcategory[];
  categories: Category[];
  onSearch: (s: string) => void;
  onFilter: (f: string) => void;
  onPage: (p: number) => void;
  onRefresh: () => void;
}) {
  const totalPages = Math.ceil(total / 20);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 도안을 삭제하시겠습니까?`)) return;
    try {
      await api(`drawings/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  const handleTogglePublish = async (id: string, isPublished: number) => {
    try {
      await api(`drawings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: isPublished ? 0 : 1 }),
      });
      onRefresh();
    } catch (e: any) {
      alert(`변경 실패: ${e.message}`);
    }
  };

  const grouped = categories.map((cat) => ({
    ...cat,
    subcats: subcategories.filter((s) => s.category_id === cat.id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
        />
        <select
          value={filterSubcategory}
          onChange={(e) => onFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
        >
          <option value="">전체 카테고리</option>
          {grouped.map((cat) => (
            <optgroup key={cat.id} label={`${cat.icon} ${cat.name_ko}`}>
              {cat.subcats.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name_ko}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500">총 {total}개 도안</p>

      {drawings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search || filterSubcategory ? "검색 결과 없음" : "아직 도안이 없습니다"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">이미지</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">난이도</th>
                <th className="px-4 py-3 font-medium">다운로드</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drawings.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <img
                      src={`https://images.ourcoloring.com/${d.thumbnail_key}`}
                      alt={d.name_ko}
                      className="w-12 h-12 object-cover rounded"
                      loading="lazy"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.name_ko}</div>
                    <div className="text-gray-400 text-xs">{d.name_en}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.subcategory_name_ko}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        d.difficulty === "easy"
                          ? "bg-green-100 text-green-700"
                          : d.difficulty === "hard"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {d.difficulty === "easy"
                        ? "쉬움"
                        : d.difficulty === "hard"
                          ? "어려움"
                          : "보통"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.download_count}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleTogglePublish(d.id, d.is_published)}
                      className={`text-xs font-medium ${d.is_published ? "text-green-600" : "text-gray-400"}`}
                    >
                      {d.is_published ? "공개" : "비공개"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(d.id, d.name_ko)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ Categories Tab (Full CRUD) ═══
function CategoriesTab({
  categories,
  subcategories,
  onRefresh,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  onRefresh: () => void;
}) {
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [editingSub, setEditingSub] = useState<(Partial<Subcategory> & { _isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const saveCat = async () => {
    if (!editingCat) return;
    setSaving(true);
    setMsg("");
    try {
      const isNew = !categories.find((c) => c.id === editingCat.id);
      const slug = editingCat.slug || editingCat.id || "";
      const payload = { type: "category", ...editingCat, slug };

      if (isNew) {
        if (!payload.id || !payload.name_ko || !payload.name_en) {
          setMsg("ID, 한국어 이름, 영어 이름은 필수입니다.");
          setSaving(false);
          return;
        }
        await api("categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setEditingCat(null);
      onRefresh();
    } catch (e: any) {
      setMsg(`오류: ${e.message}`);
    }
    setSaving(false);
  };

  const deleteCat = async (id: string, name: string) => {
    const subs = subcategories.filter((s) => s.category_id === id);
    const warn = subs.length > 0
      ? `"${name}" 카테고리와 하위 서브카테고리 ${subs.length}개를 모두 삭제합니다. 계속할까요?`
      : `"${name}" 카테고리를 삭제할까요?`;
    if (!confirm(warn)) return;
    try {
      await api("categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", id }),
      });
      onRefresh();
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  const saveSub = async () => {
    if (!editingSub) return;
    setSaving(true);
    setMsg("");
    try {
      const isNew = editingSub._isNew;
      const slug = editingSub.slug || editingSub.id || "";
      const { _isNew, ...rest } = editingSub;
      const payload = { type: "subcategory", ...rest, slug };

      if (isNew) {
        if (!payload.id || !payload.category_id || !payload.name_ko || !payload.name_en) {
          setMsg("ID, 카테고리, 한국어 이름, 영어 이름은 필수입니다.");
          setSaving(false);
          return;
        }
        await api("categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setEditingSub(null);
      onRefresh();
    } catch (e: any) {
      setMsg(`오류: ${e.message}`);
    }
    setSaving(false);
  };

  const deleteSub = async (id: string, name: string) => {
    if (!confirm(`"${name}" 서브카테고리를 삭제할까요?`)) return;
    try {
      await api("categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subcategory", id }),
      });
      onRefresh();
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">카테고리 관리</h2>
        <button
          onClick={() =>
            setEditingCat({ id: "", slug: "", name_ko: "", name_en: "", description_ko: "", description_en: "", icon: "", sort_order: categories.length + 1 })
          }
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
        >
          + 카테고리 추가
        </button>
      </div>

      {msg && <p className={`text-sm ${msg.startsWith("오류") ? "text-red-500" : "text-green-600"}`}>{msg}</p>}

      {/* ── Category Form Modal ── */}
      {editingCat && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 space-y-3">
          <h3 className="font-bold text-sm">
            {categories.find((c) => c.id === editingCat.id) ? "카테고리 수정" : "새 카테고리"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">ID (영문, 변경불가)</label>
              <input
                type="text"
                value={editingCat.id || ""}
                onChange={(e) => setEditingCat({ ...editingCat, id: e.target.value, slug: e.target.value })}
                disabled={!!categories.find((c) => c.id === editingCat.id)}
                className="w-full rounded border px-3 py-2 text-sm disabled:bg-gray-100"
                placeholder="예: play"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">아이콘 (이모지)</label>
              <input
                type="text"
                value={editingCat.icon || ""}
                onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="🎨"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이름 (한국어)</label>
              <input
                type="text"
                value={editingCat.name_ko || ""}
                onChange={(e) => setEditingCat({ ...editingCat, name_ko: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이름 (영어)</label>
              <input
                type="text"
                value={editingCat.name_en || ""}
                onChange={(e) => setEditingCat({ ...editingCat, name_en: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">설명 (한국어)</label>
              <input
                type="text"
                value={editingCat.description_ko || ""}
                onChange={(e) => setEditingCat({ ...editingCat, description_ko: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">설명 (영어)</label>
              <input
                type="text"
                value={editingCat.description_en || ""}
                onChange={(e) => setEditingCat({ ...editingCat, description_en: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정렬 순서</label>
              <input
                type="number"
                value={editingCat.sort_order ?? 0}
                onChange={(e) => setEditingCat({ ...editingCat, sort_order: +e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveCat}
              disabled={saving}
              className="rounded bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => { setEditingCat(null); setMsg(""); }}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── Subcategory Form Modal ── */}
      {editingSub && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
          <h3 className="font-bold text-sm">
            {editingSub._isNew ? "새 서브카테고리" : "서브카테고리 수정"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">ID (영문, 변경불가)</label>
              <input
                type="text"
                value={editingSub.id || ""}
                onChange={(e) => setEditingSub({ ...editingSub, id: e.target.value, slug: e.target.value })}
                disabled={!editingSub._isNew}
                className="w-full rounded border px-3 py-2 text-sm disabled:bg-gray-100"
                placeholder="예: play-dinosaur"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">소속 카테고리</label>
              <select
                value={editingSub.category_id || ""}
                onChange={(e) => setEditingSub({ ...editingSub, category_id: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">선택...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name_ko}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이름 (한국어)</label>
              <input
                type="text"
                value={editingSub.name_ko || ""}
                onChange={(e) => setEditingSub({ ...editingSub, name_ko: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">이름 (영어)</label>
              <input
                type="text"
                value={editingSub.name_en || ""}
                onChange={(e) => setEditingSub({ ...editingSub, name_en: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">설명 (한국어)</label>
              <input
                type="text"
                value={editingSub.description_ko || ""}
                onChange={(e) => setEditingSub({ ...editingSub, description_ko: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">설명 (영어)</label>
              <input
                type="text"
                value={editingSub.description_en || ""}
                onChange={(e) => setEditingSub({ ...editingSub, description_en: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">정렬 순서</label>
              <input
                type="number"
                value={editingSub.sort_order ?? 0}
                onChange={(e) => setEditingSub({ ...editingSub, sort_order: +e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveSub}
              disabled={saving}
              className="rounded bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => { setEditingSub(null); setMsg(""); }}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── Category List ── */}
      {categories.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">카테고리가 없습니다. 위 버튼으로 추가하세요.</p>
      )}

      {categories.map((cat) => {
        const subs = subcategories.filter((s) => s.category_id === cat.id);
        return (
          <div key={cat.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">
                {cat.icon} {cat.name_ko}{" "}
                <span className="text-gray-400 font-normal">({cat.name_en})</span>
                <span className="text-xs text-gray-300 ml-2">#{cat.sort_order}</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCat({ ...cat })}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  수정
                </button>
                <button
                  onClick={() => deleteCat(cat.id, cat.name_ko)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            </div>

            {cat.description_ko && (
              <p className="text-xs text-gray-400 mt-1">{cat.description_ko}</p>
            )}

            <div className="mt-3 space-y-1">
              {subs.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between text-sm pl-4 py-1.5 hover:bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 text-xs">/{cat.slug}/{sub.slug}/</span>
                    <span>{sub.name_ko}</span>
                    <span className="text-gray-400">({sub.name_en})</span>
                    <span className="text-xs text-gray-300">#{sub.sort_order}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSub({ ...sub })}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteSub(sub.id, sub.name_ko)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setEditingSub({
                  _isNew: true,
                  id: "",
                  category_id: cat.id,
                  slug: "",
                  name_ko: "",
                  name_en: "",
                  description_ko: "",
                  description_en: "",
                  sort_order: subs.length + 1,
                })
              }
              className="mt-2 text-xs text-orange-500 hover:text-orange-700 pl-4"
            >
              + 서브카테고리 추가
            </button>
          </div>
        );
      })}
    </div>
  );
}
