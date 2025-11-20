import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseServer } from '@/lib/supabaseServerClient'

export async function POST(req: NextRequest) {
  try {
    const { content, memoId } = await req.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    if (!memoId || typeof memoId !== 'string') {
      return NextResponse.json(
        { error: 'Memo ID is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // AI 요약 생성
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' })

    const prompt = `다음 메모를 간결하고 명확하게 요약해주세요. 핵심 내용만 2-3문장으로 정리해주세요.\n\n메모 내용:\n${content}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const summary = response.text().trim()

    // 데이터베이스에 요약 저장 (서버 클라이언트 사용 - RLS 우회)
    const { data: updateData, error: dbError } = await supabaseServer
      .from('memos')
      .update({ ai_summary: summary })
      .eq('id', memoId)
      .select()

    if (dbError) {
      console.error('Failed to save summary to database:', dbError)
      console.error('Error details:', JSON.stringify(dbError, null, 2))
      return NextResponse.json(
        { 
          summary,
          error: '요약은 생성되었지만 데이터베이스 저장에 실패했습니다.',
          dbError: dbError.message 
        },
        { status: 500 }
      )
    }

    if (!updateData || updateData.length === 0) {
      console.error('No rows updated for memoId:', memoId)
      return NextResponse.json(
        { 
          summary,
          error: '요약은 생성되었지만 메모를 찾을 수 없습니다.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      summary,
      saved: true 
    })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

