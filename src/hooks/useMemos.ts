'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Memo, MemoFormData } from '@/types/memo'
import { supabase, DatabaseMemo } from '@/lib/supabaseClient'

// DatabaseMemo를 Memo로 변환하는 헬퍼 함수
const dbMemoToMemo = (dbMemo: DatabaseMemo): Memo => {
  return {
    id: dbMemo.id,
    title: dbMemo.title,
    content: dbMemo.content,
    category: dbMemo.category,
    tags: dbMemo.tags,
    createdAt: dbMemo.created_at,
    updatedAt: dbMemo.updated_at,
  }
}

export const useMemos = () => {
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // 메모 로드
  useEffect(() => {
    const loadMemos = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('memos')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Failed to load memos:', error)
          setMemos([])
        } else {
          const loadedMemos = (data || []).map(dbMemoToMemo)
          setMemos(loadedMemos)
        }
      } catch (error) {
        console.error('Failed to load memos:', error)
        setMemos([])
      } finally {
        setLoading(false)
      }
    }

    loadMemos()
  }, [])

  // 메모 생성
  const createMemo = useCallback(async (formData: MemoFormData): Promise<Memo> => {
    const newMemo: Memo = {
      id: uuidv4(),
      ...formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('memos')
        .insert({
          id: newMemo.id,
          title: newMemo.title,
          content: newMemo.content,
          category: newMemo.category,
          tags: newMemo.tags,
          created_at: newMemo.createdAt,
          updated_at: newMemo.updatedAt,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create memo:', error)
        throw error
      }

      const createdMemo = dbMemoToMemo(data as DatabaseMemo)
      setMemos(prev => [createdMemo, ...prev])
      return createdMemo
    } catch (error) {
      console.error('Failed to create memo:', error)
      // Optimistic update - UI에 즉시 반영
      setMemos(prev => [newMemo, ...prev])
      throw error
    }
  }, [])

  // 메모 업데이트
  const updateMemo = useCallback(
    async (id: string, formData: MemoFormData): Promise<void> => {
      const existingMemo = memos.find(memo => memo.id === id)
      if (!existingMemo) return

      const updatedMemo: Memo = {
        ...existingMemo,
        ...formData,
        updatedAt: new Date().toISOString(),
      }

      try {
        const { error } = await supabase
          .from('memos')
          .update({
            title: updatedMemo.title,
            content: updatedMemo.content,
            category: updatedMemo.category,
            tags: updatedMemo.tags,
            updated_at: updatedMemo.updatedAt,
          })
          .eq('id', id)

        if (error) {
          console.error('Failed to update memo:', error)
          throw error
        }

        setMemos(prev => prev.map(memo => (memo.id === id ? updatedMemo : memo)))
      } catch (error) {
        console.error('Failed to update memo:', error)
        // Optimistic update 롤백
        setMemos(prev => prev.map(memo => (memo.id === id ? existingMemo : memo)))
        throw error
      }
    },
    [memos]
  )

  // 메모 삭제
  const deleteMemo = useCallback(async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('memos').delete().eq('id', id)

      if (error) {
        console.error('Failed to delete memo:', error)
        throw error
      }

      setMemos(prev => prev.filter(memo => memo.id !== id))
    } catch (error) {
      console.error('Failed to delete memo:', error)
      throw error
    }
  }, [])

  // 메모 검색
  const searchMemos = useCallback((query: string): void => {
    setSearchQuery(query)
  }, [])

  // 카테고리 필터링
  const filterByCategory = useCallback((category: string): void => {
    setSelectedCategory(category)
  }, [])

  // 특정 메모 가져오기
  const getMemoById = useCallback(
    (id: string): Memo | undefined => {
      return memos.find(memo => memo.id === id)
    },
    [memos]
  )

  // 필터링된 메모 목록
  const filteredMemos = useMemo(() => {
    let filtered = memos

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(memo => memo.category === selectedCategory)
    }

    // 검색 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        memo =>
          memo.title.toLowerCase().includes(query) ||
          memo.content.toLowerCase().includes(query) ||
          memo.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [memos, selectedCategory, searchQuery])

  // 모든 메모 삭제
  const clearAllMemos = useCallback(async (): Promise<void> => {
    try {
      const { error } = await supabase.from('memos').delete().neq('id', '')

      if (error) {
        console.error('Failed to clear memos:', error)
        throw error
      }

      setMemos([])
      setSearchQuery('')
      setSelectedCategory('all')
    } catch (error) {
      console.error('Failed to clear memos:', error)
      throw error
    }
  }, [])

  // 통계 정보
  const stats = useMemo(() => {
    const totalMemos = memos.length
    const categoryCounts = memos.reduce(
      (acc, memo) => {
        acc[memo.category] = (acc[memo.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total: totalMemos,
      byCategory: categoryCounts,
      filtered: filteredMemos.length,
    }
  }, [memos, filteredMemos])

  return {
    // 상태
    memos: filteredMemos,
    allMemos: memos,
    loading,
    searchQuery,
    selectedCategory,
    stats,

    // 메모 CRUD
    createMemo,
    updateMemo,
    deleteMemo,
    getMemoById,

    // 필터링 & 검색
    searchMemos,
    filterByCategory,

    // 유틸리티
    clearAllMemos,
  }
}
