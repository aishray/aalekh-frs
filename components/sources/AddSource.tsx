'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, Square, Upload } from 'lucide-react';
import type { Project, SourceDoc, SourceKind } from '@/lib/types';
import { Button, ErrorBox, Field, Input, Modal, Notice, Progress, Select, Tabs, Textarea } from '@/components/ui';
import { prefixFor } from '@/lib/engine/ingest';
import { extractText } from '@/lib/sources/extract';
import { buildSource, type PipelineStage } from '@/lib/sources/pipeline';
import { transcribeAudio } from '@/lib/ai/client';

const kinds: SourceKind[] = ['GO', 'Corrigendum', 'Guideline', 'Minutes', 'Form', 'VoiceBrief', 'Other'];
const kindLabel: Record<SourceKind, string> = { GO: 'Government Order', Corrigendum: 'Corrigendum', Guideline: 'Scheme guideline', Minutes: 'Meeting minutes', Form: 'Paper form', VoiceBrief: 'Voice brief', Interview: 'Interview', Other: 'Other' };

type Sample = { label: string; file: string; kind: SourceKind; name: string; refNo?: string; date?: string; authority?: string; amendsPrefix?: string };
const scholarshipSamples: Sample[] = [
  { label: 'Corrigendum 2 (grievance timeline)', file: 'corrigendum_2.txt', kind: 'Corrigendum', name: 'Corrigendum 2: grievance timeline', refNo: 'SW/2026/SCH/118-B', date: '2026-09-20', authority: 'Principal Secretary, Social Welfare Department', amendsPrefix: 'GO' },
  { label: 'Scanned application form (image)', file: 'application_form.png', kind: 'Form', name: 'Existing paper application form (scanned)', authority: 'Social Welfare Department' },
];

export function AddSourceModal({
  open,
  onClose,
  project,
  onAdded,
  defaultKind,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  onAdded: (doc: SourceDoc, warnings: string[]) => void;
  defaultKind?: SourceKind;
}) {
  const [kind, setKind] = useState<SourceKind>(defaultKind ?? 'GO');
  const [name, setName] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState('');
  const [authority, setAuthority] = useState('');
  const [amends, setAmends] = useState('');
  const [mode, setMode] = useState<'file' | 'paste' | 'voice'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<{ transcript: string; english: string; language: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind ?? 'GO');
    setName(''); setRefNo(''); setDate(''); setAuthority(''); setAmends(''); setFile(null); setText(''); setVoice(null); setError(null); setBusy(null); setMode('file');
  }, [open, defaultKind]);

  const amendable = project.sources.filter((d) => d.kind === 'GO' || d.kind === 'Guideline');
  const stages = ['Reading the document', 'Segmenting into clauses', 'Translating to English', 'Typing clauses'];

  async function loadSample(s: Sample) {
    setError(null);
    const res = await fetch(`/samples/${s.file}`);
    if (!res.ok) return setError('The sample file could not be loaded.');
    const blob = await res.blob();
    setKind(s.kind);
    setName(s.name);
    setRefNo(s.refNo ?? '');
    setDate(s.date ?? '');
    setAuthority(s.authority ?? '');
    if (s.amendsPrefix) setAmends(project.sources.find((d) => d.prefix === s.amendsPrefix)?.id ?? '');
    setFile(new File([blob], s.file, { type: blob.type }));
    setMode('file');
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await doTranscribe(new Blob(chunks.current, { type: 'audio/webm' }), 'voice-brief.webm');
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch {
      setError('Microphone access was not granted. Allow the microphone in the browser, or upload an audio file.');
    }
  }

  async function doTranscribe(blob: Blob, fname: string) {
    setRecording(false);
    setBusy(0);
    try {
      const r = await transcribeAudio(blob, fname);
      setVoice(r);
      if (!name) setName('Voice brief');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the source.');
    if (kind === 'Corrigendum' && !amends) return setError('Select the GO or guideline this corrigendum amends.');
    const prefix = prefixFor(kind, project.sources);
    try {
      setBusy(0);
      let raw = '';
      let note: string | undefined;
      if (mode === 'paste') raw = text;
      else if (mode === 'voice') {
        if (!voice) throw new Error('Record or upload the voice brief first.');
        raw = voice.transcript.split(/(?<=[.?!।])\s+/).join('\n');
      } else {
        if (!file) throw new Error('Choose a file, or paste the text.');
        const ex = await extractText(project, file);
        raw = ex.text;
        note = ex.note;
      }
      if (raw.replace(/\s/g, '').length < 20) throw new Error('No text could be read from this source. Paste the text instead.');
      const { doc, warnings } = await buildSource(project, { name: name.trim(), kind, prefix, refNo: refNo || undefined, date: date || undefined, authority: authority || undefined, amends: amends || undefined }, raw, (s: PipelineStage) =>
        setBusy(s === 'segment' ? 1 : s === 'translate' ? 2 : s === 'classify' ? 3 : 4),
      );
      if (note) warnings.unshift(note);
      onAdded(doc, warnings);
      onClose();
      toast.success(`${doc.name}: ${doc.clauses.length} clauses indexed as ${prefix}-n`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => busy == null && onClose()}
      title="Add source document"
      wide
      footer={
        <>
          <Button onClick={onClose} disabled={busy != null}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={busy != null}>Index clauses</Button>
        </>
      }
    >
      {busy != null ? (
        <Progress stages={stages} current={busy} />
      ) : (
        <div className="space-y-4">
          {project.sample === 'scholarship' && (
            <Notice>
              <span className="mr-2">Sample files:</span>
              {scholarshipSamples.map((s) => (
                <button key={s.file} onClick={() => loadSample(s)} className="mr-3 text-navy underline">{s.label}</button>
              ))}
            </Notice>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" htmlFor="src-kind">
              <Select id="src-kind" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
                {kinds.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
              </Select>
            </Field>
            <Field label="Name" htmlFor="src-name" className="col-span-2">
              <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="GO on online scholarship processing" />
            </Field>
            <Field label="Reference number" htmlFor="src-ref">
              <Input id="src-ref" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="SW/2026/SCH/118" />
            </Field>
            <Field label="Date" htmlFor="src-date">
              <Input id="src-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Issuing authority" htmlFor="src-auth">
              <Input id="src-auth" value={authority} onChange={(e) => setAuthority(e.target.value)} />
            </Field>
            {kind === 'Corrigendum' && (
              <Field label="Amends" htmlFor="src-amends" className="col-span-3" hint="Supersessions are linked automatically during reconciliation.">
                <Select id="src-amends" value={amends} onChange={(e) => setAmends(e.target.value)}>
                  <option value="">Select the document this corrigendum amends</option>
                  {amendable.map((d) => <option key={d.id} value={d.id}>{d.name} {d.refNo ? `(${d.refNo})` : ''}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <Tabs tabs={[{ id: 'file', label: 'Upload file' }, { id: 'paste', label: 'Paste text' }, { id: 'voice', label: 'Voice brief' }]} value={mode} onChange={setMode} />
          {mode === 'file' && (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line bg-canvas px-4 py-6 text-sm text-ink-muted hover:border-navy">
              <Upload className="h-5 w-5" aria-hidden />
              {file ? <span className="font-medium text-ink">{file.name}</span> : <span>PDF, DOCX, TXT, or a scanned image (PNG, JPG). Scans are read by Sarvam Document Intelligence.</span>}
              <input type="file" className="sr-only" accept=".pdf,.docx,.txt,.md,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {mode === 'paste' && (
            <Textarea aria-label="Source text" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={'1. Background\n...\n3.1 The applicant shall ...'} />
          )}
          {mode === 'voice' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {!recording ? (
                  <Button onClick={startRecording}><Mic className="h-4 w-4" aria-hidden />Record</Button>
                ) : (
                  <Button variant="danger" onClick={() => recRef.current?.stop()}><Square className="h-4 w-4" aria-hidden />Stop and transcribe</Button>
                )}
                <span className="text-sm text-ink-faint">or</span>
                <label className="cursor-pointer text-sm text-navy underline">
                  upload an audio file
                  <input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) doTranscribe(f, f.name); }} />
                </label>
                <span className="text-xs text-ink-faint">Sarvam speech to text (saaras:v3), any Indian language</span>
              </div>
              {voice && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded border border-line p-2" lang={voice.language}><p className="mb-1 text-xs text-ink-faint">Transcript ({voice.language})</p>{voice.transcript}</div>
                  <div className="rounded border border-line p-2"><p className="mb-1 text-xs text-ink-faint">English</p>{voice.english}</div>
                </div>
              )}
            </div>
          )}
          {error && <ErrorBox title="Could not add this source" message={error} />}
        </div>
      )}
    </Modal>
  );
}
