'use client'

import dynamic from 'next/dynamic'

const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full py-4 flex items-center justify-center">
        <span className="text-gray-500">로딩 중...</span>
      </div>
    ),
  }
)

interface MarkdownPreviewProps {
  source: string
  className?: string
}

export default function MarkdownPreviewComponent({
  source,
  className = '',
}: MarkdownPreviewProps) {
  return (
    <div data-color-mode="light" className={className}>
      <MarkdownPreview source={source || ''} />
    </div>
  )
}

