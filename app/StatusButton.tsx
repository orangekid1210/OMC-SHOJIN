'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const STATUS_OPTIONS = [
  { label: '未挑戦', value: '未挑戦', color: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
  { label: '挑戦中', value: '挑戦中', color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
  { label: 'AC', value: 'AC', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { label: '解説AC', value: '解説AC', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
]

export default function StatusButton({ problemId, initialStatus, onStatusChange}: { problemId: string, initialStatus: string, onStatusChange: (newStatus: string) => void}) {
  const [status, setStatus] = useState(initialStatus || '未挑戦')
  const [isOpen, setIsOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const updateStatus = async (newStatus: string) => {
    setStatus(newStatus)
    setIsOpen(false)

    onStatusChange(newStatus)
    
    // ユーザー情報を取得
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Supabaseへ保存
    const { error } = await supabase
      .from('user_progress')
      .upsert({ 
        user_id: user.id, 
        problem_id: problemId, 
        status: newStatus 
      }, { onConflict: 'user_id,problem_id' })

    if (error) console.error('Error updating status:', error)
  }

  const currentOpt = STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0]

  return (
    <div className={`relative inline-block text-left ${isOpen ? 'z-[100]' : 'z-0'}`}>
      <button
        onClick={(e) => {
          e.stopPropagation(); // 親へのイベント伝播を止める
          setIsOpen(!isOpen);
        }}
        className={`w-24 px-2 py-1.5 rounded-lg text-xs font-bold transition-all border border-transparent shadow-sm flex items-center justify-between ${currentOpt.color}`}
      >
        <span>{currentOpt.label}</span>
        <span className="text-[10px] ml-1">▼</span>
      </button>

      {isOpen && (
        <>
          {/* 背景カバーの z-index を 40 程度に下げ、メニュー(50)より後ろにする */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          
          {/* メニュー本体: absolute のままで OK ですが、z-index を明示的に高くします */}
          <div className="absolute left-0 top-full mt-1 w-28 rounded-md shadow-2xl bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-visible border border-gray-100">
            <div className="py-1 bg-white rounded-md">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStatus(option.value)}
                  className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}