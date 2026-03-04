'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import StatusButton from './StatusButton'
import Link from 'next/link'

const ITEMS_PER_PAGE = 100;

const getDiffStyle = (diff: number) => {
  // 10000（未定）の場合は黒の空の円
  if (diff === 10000) return { color: '#000000', heightPercent: 0 }; 

  // 色の判定
  let color = '#ef4444'; // デフォルト赤
  if (diff < 400) color = '#9ca3af';      // 灰
  else if (diff < 800) color = '#b45309';  // 茶
  else if (diff < 1200) color = '#22c55e'; // 緑
  else if (diff < 1600) color = '#22d3ee'; // 水
  else if (diff < 2000) color = '#2563eb'; // 青
  else if (diff < 2400) color = '#facc15'; // 黄
  else if (diff < 2800) color = '#f97316'; // 橙

  const heightPercent = Math.min(100, Math.max(0, ((diff % 400) / 400) * 100));

  return { color, heightPercent };
};

// 円内部を塗りつぶすアイコンを表示するパーツ
const DiffIcon = ({ diff }: { diff: number }) => {
  const { color, heightPercent } = getDiffStyle(diff);
  const size = 20; // アイコンの大きさ
  const radius = size / 2;
  
  // 水位のy座標を計算 (SVGは上原点なので、下から満たすために計算が必要)
  const yWater = size - (heightPercent / 100) * size;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <defs>
        {/* 円形の切り抜きマスクを定義 */}
        <clipPath id={`clipCircle-${diff}`}>
          <circle cx={radius} cy={radius} r={radius - 0.5} />
        </clipPath>
      </defs>

      {/* 背景の円 */}
      <circle
        cx={radius}
        cy={radius}
        r={radius - 1} // わずかに小さくして枠線をきれいに見せる
        fill="transparent"
        stroke={color}
        strokeWidth="0.3"
      />

      {/* 円形で切り抜かれた、色付きの水位部分 */}
      <rect
        x="0"
        y={yWater} // 計算した水位
        width={size}
        height={size} // 十分な高さ
        fill={color}
        clipPath={`url(#clipCircle-${diff})`} // 上で定義した円形で切り抜く
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
};

const CONTEST_FILTERS = [
  { label: 'すべて', min: 0, max: 99999999 },
  { label: 'OMCB', min: 99000000, max: 99999999 },
  { label: 'OMC(無印)', min: 98000000, max: 98999999 },
  { label: 'OMCE', min: 97000000, max: 97999999 },
  { label: 'SOMC', min: 96000000, max: 96999999 },
  { label: 'OMC(OLD)', min: 95000000, max: 95999999 },
  { label: 'NF杯', min: 94000000, max: 94999999 },
  { label: 'OMCG', min: 93000000, max: 93999999 },
  { label: '浜松決勝', min: 92000000, max: 92999999 },
  { label: '浜松予選', min: 91000000, max: 91999999 },
  { label: '灘中模試', min: 90000000, max: 90999999 },
  { label: '矢上杯', min: 89000000, max: 89999999 },
  { label: 'OMCT', min: 88000000, max: 88999999 },
  { label: 'TMO', min: 87000000, max: 87999999 },
  { label: 'MathPower杯', min: 86000000, max: 86999999 },
  { label: 'サーモン杯', min: 85000000, max: 85999999 },
  { label: 'OMC印高杯', min: 84000000, max: 84999999 },
  { label: 'OMC中本杯', min: 83000000, max: 83999999 },
  { label: 'その他', min: 0, max: 999999 },
];

const FIELD_OPTIONS = ['すべて', 'A', 'C', 'G', 'N'];

export default function Home() {
  const [problems, setProblems] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [selectedField, setSelectedField] = useState('すべて');
  const [minDiff, setMinDiff] = useState(0);
  const [maxDiff, setMaxDiff] = useState(10000);
  const [sortColumn, setSortColumn] = useState<'id' | 'diff'>('id');
  const [isAsc, setIsAsc] = useState(false);
  const [searchTag, setSearchTag] = useState(''); // タグ検索用
  const [searchTitle, setSearchTitle] = useState('') // タイトル検索用の状態
  const [totalCount, setTotalCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
    if (error) {
      alert("ログアウトに失敗しました: " + error.message);
    } else {
      // ユーザー状態をクリアして、ログイン画面へリダイレクト
      setUser(null);
      window.location.href = "/"; 
    }
  };
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const [selectedStatus, setSelectedStatus] = useState('すべて');

  const STATUS_OPTIONS = ['すべて', 'AC', '解説AC', '挑戦中', '未挑戦'];

  // 1. Stateを追加
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // 2. タグ一覧を取得する関数
  const fetchAllTags = async () => {
    const { data, error } = await supabase
      .from('problem_tags')
      .select('tag_name');

    if (!error && data) {
      // 重複を排除してソート
      const uniqueTags = Array.from(new Set(data.map(t => t.tag_name))).sort();
      setAllTags(uniqueTags);
    }
  };

  // 3. 初回読み込み時に実行
  useEffect(() => {
    fetchAllTags();
  }, []);

  const updateUsername = async () => {
    const newName = prompt("新しいユーザー名を入力してください", user?.user_metadata?.display_name || "");
    
    if (!newName) return; 

    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });

    if (error) {
      alert("エラーが発生しました: " + error.message);
    } else {
      alert("ユーザー名を更新しました！");
      // ユーザー情報を最新にするために再取得
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      setUser(updatedUser);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ★ fetchData を外に出す (再利用可能にする)
  async function fetchData() {
    if (problems.length === 0) setLoading(true);

    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const currentFilter = CONTEST_FILTERS[filterIndex];
    // 共通のフィルタ条件を関数化すると楽です
    const applyFilters = (q: any) => {
      let res = q.gte('id', currentFilter.min).lte('id', currentFilter.max)
                .gte('diff', minDiff).lte('diff', maxDiff);
      if (selectedField !== 'すべて') res = res.eq('field', selectedField);
      if (searchTitle) res = res.ilike('title', `%${searchTitle}%`);
      if (searchTag) res = res.filter('problem_tags.tag_name', 'ilike', `%${searchTag}%`).not('problem_tags', 'is', null);
      return res;
    };

    // ① 条件に合う「全問題数」をカウント
    const { count: allCount } = await applyFilters(
      supabase.from('problems').select('*', { count: 'exact', head: true })
    );

    // ② 条件に合う問題の中で「AC or 解説AC」の数をカウント
    // user_progress を内部結合(inner: true)して、ステータスがAC系のものだけを数える
    const { count: solvedCount } = await applyFilters(
      supabase.from('problems').select('id, user_progress!inner(status)', { count: 'exact', head: true })
    )
    .in('user_progress.status', ['AC', '解説AC'])
    .eq('user_progress.user_id', user?.id); // 自分の回答だけ

    setTotalCount(allCount || 0);
    setResolvedCount(solvedCount || 0);

    let query = supabase
      .from('problems')
      .select(`
        id, title, point, field, diff, writer, url, 
        user_progress(status),
        problem_tags(id, tag_name)
      `, { count: 'exact' });

    query = query
      .gte('id', currentFilter.min)
      .lte('id', currentFilter.max)
      .gte('diff', minDiff)
      .lte('diff', maxDiff);

    if (selectedField !== 'すべて') {
      query = query.eq('field', selectedField);
    }

    // 1. タイトル検索フィルタ（追加！）
    if (searchTitle) {
      // 'title' カラムに searchTitle の文字が含まれているかチェック
      query = query.ilike('title', `%${searchTitle}%`);
    }

    // タグ検索フィルタ
    if (searchTag) {
      // 特定のタグ名を含む問題をフィルタリング
      query = query.filter('problem_tags.tag_name', 'ilike', `%${searchTag}%`).not('problem_tags', 'is', null);
    }

    if (selectedStatus !== 'すべて') {
      if (selectedStatus === '未挑戦') {
        // user_progress が存在しない、または status が空のものを探す
        // ※内部結合ではなく外部結合のフィルタリングが必要な場合があります
        query = query.is('user_progress', null);
      } else {
        // 特定のステータスでフィルタ（!inner を使うと結合先で絞り込めます）
        query = query.eq('user_progress.status', selectedStatus).not('user_progress', 'is', null);
      }
    }

    const { data, error } = await query
      .order(sortColumn, { ascending: isAsc })
      .order('id', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setProblems(data);
    }
    setLoading(false);
  }

  // ユーザー取得 (初回のみ)
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, []);

  // データ取得 (条件変更時)
  useEffect(() => {
    fetchData();
  }, [page, filterIndex, selectedField, minDiff, maxDiff, sortColumn, isAsc, searchTag, searchTitle, selectedStatus]);

  // ★ タグの追加・削除アクション
  const handleTagAction = async (problemId: number, currentTags: any[]) => {
    const tagList = currentTags.map(t => t.tag_name).join(", ");
    const action = prompt(
      `現在のタグ: ${tagList || "なし"}\n\n操作を入力してください:\n・新しい名前を入力 → タグを追加\n・既存の名前を入力 → そのタグを削除`
    );

    if (!action) return;

    const targetTag = currentTags.find(t => t.tag_name === action.trim());

    if (targetTag) {
      // 削除
      const { error } = await supabase.from('problem_tags').delete().eq('id', targetTag.id);
      if (error) alert("削除に失敗しました");
    } else {
      // 追加
      const { error } = await supabase.from('problem_tags').insert([
        { problem_id: problemId, tag_name: action.trim() }
      ]);
      if (error) alert("追加に失敗しました (重複など)");
    }
    fetchData(); // 終わったら更新
  };

  const handleStatusUpdate = (problemId: string, newStatus: string) => {
    setProblems((prev) => prev.map((p) => p.id === problemId ? { ...p, user_progress: [{ status: newStatus }] } : p));
  };

  const toggleSort = (column: 'id' | 'diff') => {
    if (sortColumn === column) setIsAsc(!isAsc);
    else { setSortColumn(column); setIsAsc(false); }
    setPage(0);
  };

  {loading && <span>更新中...</span>}

  // 1. 各ステータスのカウント（現在の表示リストから割合を計算）
  const acCount = problems.filter(p => p.user_progress?.[0]?.status === 'AC').length;
  const expCount = problems.filter(p => p.user_progress?.[0]?.status === '解説AC').length;
  const tryingCount = problems.filter(p => p.user_progress?.[0]?.status === '挑戦中').length;

  // 2. プログレスバー用の割合計算（分母は totalCount）
  const totalForBar = totalCount || 1; 
  const acRate = (acCount / totalForBar) * 100;
  const expRate = (expCount / totalForBar) * 100;
  const tryingRate = (tryingCount / totalForBar) * 100;

  // 3. メイン達成率 (AC + 解説AC) / 全ての問題
  const currentRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  return (
    <main className="p-8 max-w-5xl mx-auto">
      {/* 1. ヘッダー部分 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-600 font-mono italic">OMC SHOJIN</h1>
        
        {/* ユーザー情報表示エリア */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4 bg-gray-100 pl-4 pr-2 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm font-bold text-gray-700">
                  {user.user_metadata?.display_name || user.email}
                </span>
              </div>

              {/* ログアウトボタン */}
              <button 
                onClick={handleLogout}
                className="bg-white hover:bg-red-50 text-red-500 text-xs font-bold py-1 px-3 rounded-full border border-red-200 transition-all hover:shadow-sm active:scale-95"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="text-blue-600 hover:underline font-bold text-sm"
            >
              ログイン画面へ移動
            </Link>
          )}
        </div>
      </div>
      
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm text-black">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* 左側：大きな数字とプログレスバー */}
            <div className="flex-1 w-full">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Filtered Progress</span>
                  <h2 className="text-3xl font-black text-gray-800">{currentRate}%</h2>
                </div>
                <div className="text-right text-sm font-bold text-gray-500">
                  {resolvedCount} / {totalCount} <span className="text-xs font-normal text-gray-400">problems</span>
                </div>
              </div>
              {/* 積み上げプログレスバー */}
              <div className="w-full bg-gray-200 h-5 rounded-full overflow-hidden shadow-inner flex border border-gray-300">
                {/* AC: 緑 */}
                <div 
                  className="bg-green-500 h-full transition-all duration-1000 ease-out border-r border-white/20" 
                  style={{ width: `${acRate}%`, minWidth: acRate > 0 ? '4px' : '0' }}
                  title={`AC: ${acCount}問`}
                />
                {/* 解説AC: 青 */}
                <div 
                  className="bg-blue-500 h-full transition-all duration-1000 ease-out border-r border-white/20" 
                  style={{ width: `${expRate}%`, minWidth: expRate > 0 ? '4px' : '0' }}
                  title={`解説AC: ${expCount}問`}
                />
                {/* 挑戦中: 黄色 */}
                <div 
                  className="bg-yellow-400 h-full transition-all duration-1000 ease-out" 
                  style={{ width: `${tryingRate}%`, minWidth: tryingRate > 0 ? '4px' : '0' }}
                  title={`挑戦中: ${tryingCount}問`}
                />
              </div>
            </div>

            {/* 右側：詳細内訳 */}
            <div className="flex gap-4 border-l border-gray-200 pl-6 hidden md:flex">
              <div className="text-center">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Pure AC</div>
                <div className="text-xl font-black text-green-600">{acCount}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Explanation</div>
                <div className="text-xl font-black text-blue-500">{expCount}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Trying</div>
                <div className="text-xl font-black text-yellow-500">{tryingCount}</div>
              </div>
            </div>
          </div>
          
          {/* 絞り込み内容の補足（おまけ） */}
          {(searchTag || searchTitle) && (
            <div className="mt-4 pt-4 border-t border-blue-100 flex gap-2 overflow-x-auto">
              {searchTag && <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-bold">Tag: {searchTag}</span>}
              {searchTitle && <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Title: {searchTitle}</span>}
            </div>
          )}
        </div>

      {/* タグ一覧エリア */}
      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-6 3 6 3-6 3"></path></svg>
            Quick Tag Filter
          </label>
          
          {/* 展開ボタン */}
          <button 
            onClick={() => setIsTagsOpen(!isTagsOpen)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            {isTagsOpen ? '閉じる ▲' : 'もっと見る ▼'}
          </button>
        </div>

        <div className="relative">
          <div 
            className={`flex flex-wrap gap-2 transition-all duration-500 ease-in-out overflow-hidden ${
              isTagsOpen ? 'max-h-[1000px]' : 'max-h-[40px]' // 40pxはおよそ1~2行分
            }`}
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSearchTag(searchTag === tag ? '' : tag);
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
                  searchTag === tag
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                # {tag}
              </button>
            ))}
            
            {allTags.length === 0 && <span className="text-gray-400 text-xs italic">No tags found.</span>}
          </div>

          {/* 閉じている時のグラデーション隠し */}
          {!isTagsOpen && allTags.length > 10 && (
            <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>

      {/* フィルタパネル */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm text-black">
        {/* 絞り込み条件下の達成率表示 */}
        {/* タイトル検索入力欄 */}
        <div className="flex-1">
          <label className="text-xs font-black text-gray-500 uppercase">Title Search</label>
          <div className="relative">
            <input
              type="text"
              placeholder="問題名を入力（例: OMC001(A)）"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-black"
            />
            {searchTitle && (
              <button 
                onClick={() => setSearchTitle('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-gray-500 uppercase">Tag Search</label>
          <input 
            type="text" 
            value={searchTag} 
            onChange={(e) => { setSearchTag(e.target.value); setPage(0); }}
            placeholder="タグ名で検索..."
            className="bg-white border border-gray-300 text-sm rounded-lg p-2"
          />
          {searchTag && (
            <button 
              onClick={() => setSearchTag('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        {/* status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            Status Filter
          </label>
          <select 
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            className="bg-white border border-gray-300 text-sm rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-black"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {/* コンテスト選択（既存） */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-gray-500 uppercase">Contest</label>
          <select 
            value={filterIndex}
            onChange={(e) => { setFilterIndex(Number(e.target.value)); setPage(0); }}
            className="bg-white border border-gray-300 text-sm rounded-lg p-2"
          >
            {CONTEST_FILTERS.map((f, index) => (
              <option key={f.label} value={index}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* 分野選択 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-gray-500 uppercase">Field</label>
          <select 
            value={selectedField}
            onChange={(e) => { setSelectedField(e.target.value); setPage(0); }}
            className="bg-white border border-gray-300 text-sm rounded-lg p-2"
          >
            {FIELD_OPTIONS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Diff範囲指定 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-gray-500 uppercase">Difficulty Range</label>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              value={minDiff}
              onChange={(e) => { setMinDiff(Number(e.target.value)); setPage(0); }}
              className="w-full bg-white border border-gray-300 text-sm rounded-lg p-2"
              placeholder="Min"
            />
            <span className="text-gray-400">〜</span>
            <input 
              type="number"
              value={maxDiff}
              onChange={(e) => { setMaxDiff(Number(e.target.value)); setPage(0); }}
              className="w-full bg-white border border-gray-300 text-sm rounded-lg p-2"
              placeholder="Max"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-xl overflow-visible border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-black">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Status</th>
              {/* Title（実質ID順）にソート機能を追加 */}
              <th 
                className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleSort('id')}
              >
                Title {sortColumn === 'id' ? (isAsc ? '▲' : '▼') : ''}
              </th>
              {/* Diffにソート機能を追加（DiffIconの隣など、場所はお好みで） */}
              <th 
                className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleSort('diff')}
              >
                Diff {sortColumn === 'diff' ? (isAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {problems.map((p) => {
              const currentStatus = p.user_progress?.[0]?.status || '未挑戦';
              const rowColor = 
                  currentStatus === 'AC' ? 'bg-green-100' : 
                  currentStatus === '解説AC' ? 'bg-blue-100' : 
                  currentStatus === '挑戦中' ? 'bg-yellow-100' : 
                  'bg-white'; // 未挑戦は白              

              return (
                  <tr 
                    key={p.id} 
                    className={`
                      ${rowColor}
                      hover:brightness-95 transition-all border-b border-gray-100
                    `}
                    style={{ position: 'relative', zIndex: 'auto' }}
                    onMouseEnter={(e) => (e.currentTarget.style.zIndex = '10')}
                    onMouseLeave={(e) => (e.currentTarget.style.zIndex = 'auto')}
                  >
                    <td className="px-6 py-4 relative">
                      <StatusButton 
                        problemId={p.id} 
                        initialStatus={currentStatus} 
                        onStatusChange={(newStatus) => handleStatusUpdate(p.id, newStatus)} // 関数を渡す
                      />
                    </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* 新しい円環アイコン */}
                      <div className="relative group cursor-help">
                        <DiffIcon diff={p.diff} />
                        
                        {/* ツールチップ (ホバーで表示) */}
                        <div className="absolute left-8 top-0 hidden group-hover:block z-50 w-40 p-3 bg-gray-900/95 text-white text-xs rounded-lg shadow-2xl backdrop-blur-sm border border-gray-700">
                          <div className="font-bold border-b border-gray-700 pb-1 mb-2 text-blue-400">Problem Info</div>
                          <div className="space-y-1">
                            <p>
                              <span className="text-gray-400">Diff:</span>{' '}
                              <span className="font-mono font-bold">
                                {p.diff === 10000 ? '-' : p.diff} {/* 10000なら - 、それ以外なら数字を表示 */}
                              </span>
                            </p>
                            <p><span className="text-gray-400">Point:</span> {p.point}</p>
                            <p><span className="text-gray-400">Field:</span> {p.field}</p>
                            <p><span className="text-gray-400">Writer:</span> {p.writer}</p>
                          </div>
                        </div>
                      </div>

                      {/* タイトルとリンク */}
                      <div>
                        <a 
                          href={p.url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-500 underline-offset-4 transition-all"
                        >
                          {p.title}
                        </a>
                        {/* タグボタン */}
                        <button 
                          onClick={() => handleTagAction(p.id, p.problem_tags || [])}
                          className="text-[10px] bg-gray-100 hover:bg-blue-200 px-2 py-0.5 rounded text-gray-500 transition-colors"
                        >
                          🏷️ {p.problem_tags?.length || 0}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-sm text-gray-700">
                    {p.diff === 10000 ? '-' : p.diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 bg-white border rounded-lg shadow-sm disabled:opacity-30 hover:bg-gray-50 transition-colors"
        >
          ← 前の100件
        </button>
        
        <span className="font-bold text-gray-700">
          PAGE {page + 1}
        </span>

        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={problems.length < ITEMS_PER_PAGE}
          className="px-4 py-2 bg-white border rounded-lg shadow-sm disabled:opacity-30 hover:bg-gray-50 transition-colors"
        >
          次の100件 →
        </button>
      </div>
      
      <p className="text-center text-gray-400 text-xs mt-4">
        表示中: {page * ITEMS_PER_PAGE + 1} 〜 {page * ITEMS_PER_PAGE + problems.length} 件目
      </p>      
    </main>
  )
}