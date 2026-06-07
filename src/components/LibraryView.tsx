'use client'

import { useRef, useCallback } from 'react'
import type { AuditRunHook } from '@/hooks/useAuditRun'
import type { FundDocument } from '@/types'
import { formatDate } from '@/lib/utils'

const ACCEPTED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
]
const MAX_MB   = 10

function DocCard({
  doc, onProfile,
}: {
  doc: FundDocument
  onProfile: (id: string) => void
}) {
  const isProfiled = !!doc.profileJson
  const sizeMB     = (doc.fileSizeBytes / 1024 / 1024).toFixed(1)

  return (
    <div className="flex items-start gap-4 rounded-xl bg-surface-800 border border-border px-5 py-4">
      {/* File icon */}
      <div className="shrink-0 mt-0.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
          isProfiled ? 'bg-accent/10 text-accent' : 'bg-surface-700 text-muted'
        }`}>
          PDF
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-primary text-sm font-medium truncate" title={doc.filename}>
          {doc.filename}
        </p>
        <p className="text-secondary text-xs mt-0.5 font-mono">
          {sizeMB} MB
          {doc.profileJson && (
            <> &middot; <span className="text-accent">{doc.profileJson.documentType}</span>
            {doc.profileJson.fundName && ` · ${doc.profileJson.fundName}`}
            </>
          )}
          {!isProfiled && ' · Not yet profiled'}
        </p>
        {isProfiled && doc.profiledAt && (
          <p className="text-label text-xs mt-1">Profiled {formatDate(doc.profiledAt)}</p>
        )}
        {isProfiled && doc.profileJson?.warningFlags && doc.profileJson.warningFlags.length > 0 && (
          <p className="text-flag text-xs mt-1">
            {doc.profileJson.warningFlags.length} warning flag{doc.profileJson.warningFlags.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isProfiled ? (
          <span className="flex items-center gap-1 text-xs text-positive">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Profiled
          </span>
        ) : (
          <button
            onClick={() => onProfile(doc.id)}
            className="text-xs rounded-lg px-3 py-1.5 bg-surface-700 text-secondary hover:text-accent hover:bg-surface-700 border border-border hover:border-accent/30 transition-colors"
          >
            Profile
          </button>
        )}
      </div>
    </div>
  )
}

function UploadProgress({ progress }: { progress: Record<string, string> }) {
  const entries = Object.entries(progress)
  if (entries.length === 0) return null
  return (
    <div className="space-y-2">
      {entries.map(([name, stage]) => (
        <div key={name} className="flex items-center gap-3 rounded-xl bg-surface-800 border border-border px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            {stage === 'error' ? (
              <svg className="w-4 h-4 text-negative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-primary text-sm truncate">{name}</p>
            <p className={`text-xs mt-0.5 ${stage === 'error' ? 'text-negative' : 'text-secondary'}`}>
              {stage === 'uploading' ? 'Uploading...' :
               stage === 'profiling' ? 'AI profiling document...' :
               stage === 'error'     ? 'Failed' : 'Done'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function LibraryView({
  documents, uploadProgress, uploadDocument, profileDocument,
  currentEngagement, setView,
}: Pick<AuditRunHook, 'documents' | 'uploadProgress' | 'uploadDocument' | 'profileDocument' | 'currentEngagement' | 'setView'>) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) continue
      if (file.size > MAX_MB * 1024 * 1024) continue
      await uploadDocument(file)
    }
  }, [uploadDocument])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const profiledCount = documents.filter(d => d.profileJson).length

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-label font-display">
            Document Library
          </p>
          <h2 className="text-primary text-xl font-semibold font-display mt-1">
            {currentEngagement?.fundName}
          </h2>
        </div>
        <button
          disabled={profiledCount === 0}
          onClick={() => setView('setup')}
          className="rounded-lg bg-accent text-surface-950 font-semibold px-5 py-2.5 text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Set Up Audit →
        </button>
      </div>

      {/* Upload zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed border-border hover:border-accent/40 bg-surface-900 px-8 py-12 text-center cursor-pointer transition-colors group"
      >
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/10 transition-colors">
          <svg className="w-6 h-6 text-muted group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-primary text-sm font-medium">Drop PDF or Word files here or click to browse</p>
        <p className="text-secondary text-xs mt-1">PDF or Word (.docx/.doc) · max {MAX_MB} MB per file</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Upload progress */}
      <UploadProgress progress={uploadProgress} />

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-label font-display">
              {documents.length} Document{documents.length !== 1 ? 's' : ''} &middot; {profiledCount} Profiled
            </p>
          </div>
          <div className="space-y-2">
            {documents.map(doc => (
              <DocCard key={doc.id} doc={doc} onProfile={profileDocument} />
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && Object.keys(uploadProgress).length === 0 && (
        <p className="text-center text-secondary text-sm py-8">
          No documents yet — upload PDF or Word files above to begin.
        </p>
      )}
    </div>
  )
}
