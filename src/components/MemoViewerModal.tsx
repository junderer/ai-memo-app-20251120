'use client'

import { useEffect, useState } from 'react'
import { Memo, MEMO_CATEGORIES } from '@/types/memo'
import MarkdownPreview from './MarkdownPreview'
import { supabase } from '@/lib/supabaseClient'

interface MemoViewerModalProps {
  isOpen: boolean
  memo: Memo | null
  onClose: () => void
  onEdit: (memo: Memo) => void
  onDelete: (id: string) => void
}

export default function MemoViewerModal({
  isOpen,
  memo,
  onClose,
  onEdit,
  onDelete,
}: MemoViewerModalProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  useEffect(() => {
    // 모달이 닫힐 때 요약 상태 초기화
    if (!isOpen) {
      setSummary(null)
      setSummaryError(null)
    }
  }, [isOpen])

  // 메모가 열릴 때 저장된 요약이 있으면 로드
  useEffect(() => {
    const loadSavedSummary = async () => {
      if (!isOpen || !memo) return

      try {
        const { data, error } = await supabase
          .from('memos')
          .select('ai_summary')
          .eq('id', memo.id)
          .single()

        if (!error && data?.ai_summary) {
          setSummary(data.ai_summary)
        }
      } catch (error) {
        console.error('Failed to load saved summary:', error)
        // 요약 로드 실패는 무시 (사용자 경험에 큰 영향 없음)
      }
    }

    loadSavedSummary()
  }, [isOpen, memo])

  if (!isOpen || !memo) return null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-100 text-blue-800',
      work: 'bg-green-100 text-green-800',
      study: 'bg-purple-100 text-purple-800',
      idea: 'bg-yellow-100 text-yellow-800',
      other: 'bg-gray-100 text-gray-800',
    }
    return colors[category as keyof typeof colors] || colors.other
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleDelete = () => {
    if (window.confirm('정말로 이 메모를 삭제하시겠습니까?')) {
      onDelete(memo.id)
    }
  }

  const handleSummarize = async () => {
    setIsLoadingSummary(true)
    setSummaryError(null)

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: memo.content,
          memoId: memo.id 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // 요약은 생성되었지만 DB 저장 실패한 경우
        if (data.summary) {
          setSummary(data.summary)
          setSummaryError(
            `요약은 생성되었지만 저장에 실패했습니다: ${data.error || data.dbError || '알 수 없는 오류'}`
          )
        } else {
          throw new Error(data.error || '요약 생성에 실패했습니다.')
        }
        return
      }

      // 성공적으로 저장된 경우
      setSummary(data.summary)
      
      // 저장된 요약을 다시 로드하여 확인
      setTimeout(async () => {
        try {
          const { data: memoData, error: loadError } = await supabase
            .from('memos')
            .select('ai_summary')
            .eq('id', memo.id)
            .single()

          if (!loadError && memoData?.ai_summary) {
            // 저장 확인 완료
            console.log('Summary saved successfully')
          }
        } catch (err) {
          console.error('Failed to verify saved summary:', err)
        }
      }, 500)
    } catch (error) {
      console.error('Error generating summary:', error)
      setSummaryError(
        error instanceof Error
          ? error.message
          : '요약을 생성하는 중 오류가 발생했습니다.'
      )
    } finally {
      setIsLoadingSummary(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {memo.title}
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(memo.category)}`}
                >
                  {MEMO_CATEGORIES[memo.category as keyof typeof MEMO_CATEGORIES] ||
                    memo.category}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(memo.updatedAt)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-4"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 요약 섹션 */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                AI 요약
              </h3>
              <button
                onClick={handleSummarize}
                disabled={isLoadingSummary}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                {isLoadingSummary ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    생성 중...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    요약 생성
                  </>
                )}
              </button>
            </div>
            {summary && (
              <div className="mt-3 p-3 bg-white rounded-md border border-blue-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {summary}
                </p>
              </div>
            )}
            {summaryError && (
              <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-200">
                <p className="text-sm text-red-700">{summaryError}</p>
              </div>
            )}
            {!summary && !summaryError && !isLoadingSummary && (
              <p className="text-xs text-blue-600 mt-2">
                버튼을 클릭하여 AI가 메모를 요약해드립니다.
              </p>
            )}
          </div>

          {/* 내용 */}
          <div className="mb-6">
            <MarkdownPreview source={memo.content} />
          </div>

          {/* 태그 */}
          {memo.tags.length > 0 && (
            <div className="mb-6">
              <div className="flex gap-2 flex-wrap">
                {memo.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onEdit(memo)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              편집
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

