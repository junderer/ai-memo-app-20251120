import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseServer } from '@/lib/supabaseServerClient'

export async function POST(req: NextRequest) {
  try {
    const { title, content, memoId } = await req.json()

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
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

    // AI 태그 생성
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' })

    const prompt = `다음 메모의 제목과 내용을 분석하여 적절한 태그를 3~6개 생성해주세요. 각 태그는 한 단어 또는 짧은 구문(최대 2단어)으로 작성하고, JSON 배열 형식으로만 응답해주세요. 다른 설명 없이 태그 배열만 반환해주세요.

예시 형식: ["태그1", "태그2", "태그3"]

제목: ${title}
내용: ${content}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text().trim()

    // JSON 배열 파싱 시도
    let tags: string[] = []
    try {
      // JSON 코드 블록이 있는 경우 제거
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanedText)
      if (Array.isArray(parsed)) {
        tags = parsed.filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      } else {
        throw new Error('Response is not an array')
      }
    } catch (parseError) {
      // JSON 파싱 실패 시 줄바꿈이나 쉼표로 분리 시도
      const lines = responseText.split(/[,\n]/).map(line => line.trim().replace(/^["'\[#]|["'\]]#?$/g, ''))
      tags = lines.filter(line => line.length > 0 && line.length <= 20).slice(0, 6)
    }

    // 태그가 없으면 에러 반환
    if (tags.length === 0) {
      return NextResponse.json(
        { error: '태그를 생성할 수 없습니다.' },
        { status: 500 }
      )
    }

    // memoId가 전달되면 데이터베이스에 즉시 저장
    if (memoId && typeof memoId === 'string') {
      const { data: updateData, error: dbError } = await supabaseServer
        .from('memos')
        .update({ tags })
        .eq('id', memoId)
        .select()

      if (dbError) {
        console.error('Failed to save tags to database:', dbError)
        return NextResponse.json(
          {
            tags,
            error: '태그는 생성되었지만 데이터베이스 저장에 실패했습니다.',
            dbError: dbError.message,
          },
          { status: 500 }
        )
      }

      if (!updateData || updateData.length === 0) {
        console.error('No rows updated for memoId:', memoId)
        return NextResponse.json(
          {
            tags,
            error: '태그는 생성되었지만 메모를 찾을 수 없습니다.',
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        tags,
        saved: true,
      })
    }

    // memoId가 없으면 태그만 반환
    return NextResponse.json({
      tags,
      saved: false,
    })
  } catch (error) {
    console.error('Error generating tags:', error)
    return NextResponse.json(
      { error: 'Failed to generate tags' },
      { status: 500 }
    )
  }
}

