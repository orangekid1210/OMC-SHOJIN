'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('') // ユーザー名用のステートを追加
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const handleSignUp = async () => {
    if (!displayName) {
      alert('ユーザー名を入力してください')
      return
    }

    // --- 修正開始 ---
    try {
      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          displayName // ユーザー名も一緒に送信
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message || '確認メールを送信しました！Resendの登録メールを確認してください。');
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('通信エラーが発生しました。');
    }
    // --- 修正終了 ---
  }

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else {
      alert('ログイン成功！')
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-black">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">OMC SHOJIN ログイン</h1>
        
        <div className="space-y-4">
          {/* ユーザー名入力欄を追加 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">ユーザー名 (新規作成時のみ)</label>
            <input 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white" 
              type="text" 
              placeholder="精進太郎" 
              onChange={(e) => setDisplayName(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
            <input 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white" 
              type="email" 
              placeholder="example@omc.com" 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">パスワード</label>
            <input 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-white" 
              type="password" 
              placeholder="••••••••" 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button onClick={handleSignIn} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition">
            ログイン
          </button>
          <button onClick={handleSignUp} className="w-full bg-white text-gray-600 border border-gray-300 font-bold py-2 rounded hover:bg-gray-50 transition text-sm">
            新規アカウント作成
          </button>
        </div>
        <p className="mt-4 text-[10px] text-gray-400 text-center">
          ※新規作成時はユーザー名を入力してください。
        </p>
      </div>
    </div>
  )
}