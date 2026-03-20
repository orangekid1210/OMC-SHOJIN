import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 認証後のリダイレクト先（デフォルトはトップページ）
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // 認可コードをセッションに交換してログイン状態にする
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 成功したら指定のページへ
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // エラーが発生した場合（リンク切れなど）
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}