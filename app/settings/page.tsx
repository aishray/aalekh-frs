'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useRepo, defaultReasoning } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { TASKS, SPEECH, TRANSLATE, VISION, type AiTask, type Reasoning } from '@/lib/ai/models';
import { Badge, Button, ErrorBox, Field, Input, Modal, Notice, PageHeader, PageSkeleton, Panel, Select, td, th } from '@/components/ui';
import { branding } from '@/config/branding';

type ModelResult = { model: string; ok: boolean; latencyMs: number; error?: string };
type Status = { ok: boolean; configured: boolean; message: string; models: ModelResult[] };

export default function SettingsPage() {
  const hydrated = useHydrated();
  const settings = useRepo((s) => s.settings);
  const setSettings = useRepo((s) => s.setSettings);
  const resetSample = useRepo((s) => s.resetSample);
  const resetAll = useRepo((s) => s.resetAll);
  const log = useRepo((s) => s.log);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [orgLine, setOrgLine] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'sample' | 'all' | null>(null);

  if (!hydrated) return <PageSkeleton />;

  async function testConnection() {
    setTesting(true);
    setStatus(null);
    setTestError(null);
    try {
      const res = await fetch('/api/ai/status', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `The server returned ${res.status}.`);
      setStatus(j as Status);
      log('Tested AI connection', (j as Status).ok ? 'Connected' : 'Failed');
    } catch (e) {
      setTestError((e as Error).message || 'Could not reach the application server.');
    } finally {
      setTesting(false);
    }
  }

  const reasoning = { ...defaultReasoning, ...settings.reasoning };
  const setReasoning = (task: AiTask, v: Reasoning) => setSettings({ reasoning: { ...reasoning, [task]: v } });
  const changed = (Object.keys(TASKS) as AiTask[]).some((t) => reasoning[t] !== TASKS[t].reasoning);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="AI engine, recorded responses, branding and sample data." />

      <Panel
        title="AI engine: Sarvam AI"
        subtitle="All calls go through the application server. The API key stays on the server and never reaches the browser."
        actions={<Button variant="primary" onClick={testConnection} loading={testing}>Test connection</Button>}
      >
        {testError && <ErrorBox title="Connection test did not run" message={testError} />}
        {status && (
          <div className="mb-4 space-y-2" data-testid="ai-status">
            {!status.configured ? (
              <ErrorBox title="The AI engine is not configured" message={status.message} />
            ) : (
              <ul className="space-y-1.5">
                {status.models.map((m) => (
                  <li key={m.model} className="flex items-start gap-2 text-sm">
                    {m.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-ok" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 text-bad" aria-hidden />}
                    <span>
                      {m.ok ? <>Connected to <span className="font-mono">{m.model}</span> in {m.latencyMs} ms</> : <><span className="font-mono">{m.model}</span>: {m.error}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Task</th>
                <th className={th}>Model</th>
                <th className={th}>Reasoning</th>
                <th className={th + ' text-right'}>Max tokens</th>
                <th className={th + ' text-right'}>Timeout</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TASKS) as AiTask[]).map((t) => (
                <tr key={t}>
                  <td className={td}>{TASKS[t].label}</td>
                  <td className={td + ' font-mono text-xs'}>{TASKS[t].model}</td>
                  <td className={td}>
                    <Select aria-label={`Reasoning for ${TASKS[t].label}`} className="h-7 w-28 text-xs" value={reasoning[t]} onChange={(e) => setReasoning(t, e.target.value as Reasoning)}>
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                    </Select>
                  </td>
                  <td className={td + ' text-right tabular-nums'}>{TASKS[t].maxTokens.toLocaleString('en-IN')}</td>
                  <td className={td + ' text-right tabular-nums'}>{TASKS[t].timeoutMs / 1000} s</td>
                </tr>
              ))}
              <tr>
                <td className={td}>Speech to text (voice briefs)</td>
                <td className={td + ' font-mono text-xs'}>{SPEECH.model}</td>
                <td className={td + ' text-ink-faint'} colSpan={3}>Audio up to {SPEECH.maxSeconds} seconds; language detected automatically</td>
              </tr>
              <tr>
                <td className={td}>Clause and Hindi FRS translation</td>
                <td className={td + ' font-mono text-xs'}>{TRANSLATE.model}</td>
                <td className={td + ' text-ink-faint'} colSpan={3}>Formal mode; IDs and acronyms preserved</td>
              </tr>
              <tr>
                <td className={td}>Scanned forms and PDFs</td>
                <td className={td + ' font-mono text-xs'}>{VISION.model}</td>
                <td className={td + ' text-ink-faint'} colSpan={3}>Document Intelligence; PDF up to {VISION.maxPages} pages, PNG or JPG</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-muted">
          <p>Reasoning is off by default. On sarvam-105b a reasoning trace can run for several minutes, beyond the 300 second hosting limit; turn it on only for local runs. Turning it on raises the task token budget and timeout.</p>
          <Button size="sm" disabled={!changed} onClick={() => { setSettings({ reasoning: { ...defaultReasoning } }); toast.success('Reasoning settings restored to defaults'); }}>Restore defaults</Button>
        </div>
      </Panel>

      <Panel title="Recorded responses" subtitle="Makes the demo deterministic and usable without network access.">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-navy" checked={settings.recorded} onChange={(e) => { setSettings({ recorded: e.target.checked }); log(e.target.checked ? 'Turned on recorded responses' : 'Turned off recorded responses'); }} />
          <span>
            <span className="font-medium">Use recorded responses for sample projects</span>
            <span className="block text-ink-muted">
              On: the State Post-Matric Scholarship Portal replays responses recorded from the live Sarvam API, with realistic timing. Off: every step calls Sarvam live.
              New projects always run live. If a live call fails for the sample project, the recording is used instead.
            </span>
          </span>
        </label>
        <div className="mt-2"><Badge tone={settings.recorded ? 'ok' : 'navy'}>{settings.recorded ? 'Recorded mode on for the sample project' : 'Live mode for all projects'}</Badge></div>
      </Panel>

      <Panel title="Branding" subtitle="Printed on the cover page and page footers of exported Word documents.">
        <div className="grid max-w-2xl grid-cols-1 gap-3">
          <Field label="Organisation line" htmlFor="org-line">
            <Input id="org-line" value={orgLine ?? settings.orgLine} onChange={(e) => setOrgLine(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-muted">Product {branding.product}; state {branding.state}. All names, the state and GO numbers in the sample data are fictional.</p>
          <div>
            <Button
              variant="primary"
              disabled={orgLine == null || !orgLine.trim() || orgLine === settings.orgLine}
              onClick={() => { setSettings({ orgLine: orgLine!.trim() }); log('Changed organisation line', orgLine!.trim()); setOrgLine(null); toast.success('Organisation line saved'); }}
            >
              Save
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Sample data" subtitle="Data is kept in this browser. Resetting cannot be undone.">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setConfirm('sample')}>Reset sample project</Button>
          <Button variant="danger" onClick={() => setConfirm('all')}>Reset all data</Button>
          <span className="text-xs text-ink-muted">Shortcut: Shift+R resets the sample project; Shift+P opens presenter notes; Ctrl+K searches.</span>
        </div>
      </Panel>

      <Notice tone="neutral">Deployment note: live AI calls are limited to 30 per 10 minutes from one address so a public link cannot exhaust Sarvam credits. Recorded replays are not counted.</Notice>

      <Modal
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={confirm === 'all' ? 'Reset all data?' : 'Reset the sample project?'}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === 'all') resetAll();
                else resetSample();
                toast.success(confirm === 'all' ? 'All projects restored to the seed data' : 'Sample project reset to its sources');
                setConfirm(null);
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {confirm === 'all'
            ? 'All projects, the activity log and settings return to the seed data. Your own projects are deleted.'
            : 'The State Post-Matric Scholarship Portal returns to its sources only. Reconciliation, model, FRS, review and change history are cleared.'}
        </p>
      </Modal>
    </div>
  );
}
