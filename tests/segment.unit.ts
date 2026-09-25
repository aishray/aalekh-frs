import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { segment } from '@/lib/engine/segment';

const read = (f: string) => fs.readFileSync(`data/sources/${f}`, 'utf8');

describe('clause segmentation', () => {
  it('segments the sample GO into numbered clauses', () => {
    const { segments, method } = segment(read('go_scholarship.txt'));
    expect(method).toBe('numbered');
    expect(segments.map((s) => s.num)).toEqual([
      '1', '2', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '4.3', '5.1', '5.2', '5.3', '6.1', '6.2', '7.1', '7.2', '7.3', '8.1', '8.2', '9', '10',
    ]);
    expect(segments.find((s) => s.num === '1')!.text).toContain('6 to 9 months');
    expect(segments.find((s) => s.num === '10')!.text).not.toContain('Governor');
  });

  it('segments minutes by item', () => {
    const { segments } = segment(read('minutes_kickoff.txt'));
    expect(segments.map((s) => s.num)).toEqual(['1', '2', '3', '4', '5']);
    expect(segments[3].text).toContain('10 days');
  });

  it('falls back to paragraphs for the voice brief', () => {
    const { segments, method, needsLlm } = segment(read('voice_brief_hi.txt'));
    expect(method).toBe('paragraphs');
    expect(needsLlm).toBe(false);
    expect(segments).toHaveLength(3);
  });

  it('segments the form by field', () => {
    const { segments } = segment(read('application_form.txt'));
    expect(segments).toHaveLength(20);
  });

  it('handles corrigendum paragraphs with long text', () => {
    const { segments } = segment(read('corrigendum_1.txt') + '\n3. Para 3 text that is long enough to be a clause body.');
    expect(segments[0].num).toBe('1');
    expect(segments[0].text).toContain('3,00,000');
  });
});
