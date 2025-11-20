'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">에디터를 불러오는 중...</span>
      </div>
    ),
  }
)

interface MarkdownEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  height?: number
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '마크다운으로 메모를 작성하세요...',
  height = 400,
}: MarkdownEditorProps) {
  const [data, setData] = useState(value || '')

  useEffect(() => {
    setData(value || '')
  }, [value])

  const handleChange = (val: string | undefined) => {
    const newValue = val || ''
    setData(newValue)
    onChange(newValue)
  }

  return (
    <div data-color-mode="light">
      <MDEditor
        value={data}
        onChange={handleChange}
        preview="live"
        hideToolbar={false}
        height={height}
        textareaProps={{
          placeholder,
        }}
      />
    </div>
  )
}

