import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Resendの初期化
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, password, displayName } = await request.json()
    const origin = new URL(request.url).origin
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // 1. Supabaseでユーザーを作成
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // ここで先ほど作った callback へのリダイレクトを指定
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
            display_name: displayName
        }
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // 2. Resendでカスタムメールを送信
    // Supabaseが生成した「認証用リンク」を取得します
    const authData = data as any;
    let confirmLink = authData.properties?.action_link;

    // もし action_link が取れない場合の最終手段（OTP方式への切り替え用リンク）
    if (!confirmLink) {
      confirmLink = `${origin}/auth/callback?code=${data.user?.id}`; 
    }

    const { error: resendError } = await resend.emails.send({
      from: 'OMC Shojin <onboarding@resend.dev>', // 独自ドメインがない間はこのまま
      to: email,
      subject: '【OMC SHOJIN】メールアドレスの確認',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto;">
          <h2>OMC SHOJINへようこそ！</h2>
          <p>登録を完了するには、以下のボタンをクリックしてメールアドレスを認証してください。</p>
          <div style="margin: 30px 0;">
            <a href="${confirmLink}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              メールアドレスを認証する
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">もし心当たりがない場合は、このメールを無視してください。</p>
        </div>
      `,
    })

    if (resendError) {
      console.error('Resend Error:', resendError)
      return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ message: '確認メールを送信しました。メールボックスを確認してください。' })

  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}