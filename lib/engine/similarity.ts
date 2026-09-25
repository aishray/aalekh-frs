import type { Project, Requirement } from '@/lib/types';

const STOP = new Set('the a an of to and or for in on by with shall system be is are as at from that this it its each every any all which when then given who whose their into than not no only per within after before'.split(' '));

export function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ''));
}

export type LibraryItem = { projectId: string; projectName: string; req: Requirement };

/** Approved requirements from baselined projects: the reuse library. */
export function libraryItems(projects: Project[], excludeId?: string): LibraryItem[] {
  return projects
    .filter((p) => p.id !== excludeId && (p.status === 'Approved' || p.baseline))
    .flatMap((p) => (p.baseline?.snapshot.requirements ?? p.requirements).map((req) => ({ projectId: p.id, projectName: p.name, req })));
}

/** Simple TF-IDF with cosine similarity: enough for a few thousand requirements, no vector database. */
export class TfIdf {
  private idf = new Map<string, number>();
  private vecs: Map<string, number>[] = [];
  constructor(private docs: string[]) {
    const df = new Map<string, number>();
    const toks = docs.map(tokens);
    toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
    const n = docs.length;
    df.forEach((v, k) => this.idf.set(k, Math.log((n + 1) / (v + 1)) + 1));
    this.vecs = toks.map((t) => this.vec(t));
  }
  private vec(t: string[]) {
    const tf = new Map<string, number>();
    t.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
    const v = new Map<string, number>();
    let norm = 0;
    tf.forEach((c, w) => {
      const x = c * (this.idf.get(w) ?? Math.log(this.docs.length + 1) + 1);
      v.set(w, x);
      norm += x * x;
    });
    norm = Math.sqrt(norm) || 1;
    v.forEach((x, w) => v.set(w, x / norm));
    return v;
  }
  query(text: string, k = 5): { index: number; score: number }[] {
    const q = this.vec(tokens(text));
    return this.vecs
      .map((v, index) => {
        let s = 0;
        q.forEach((x, w) => (s += x * (v.get(w) ?? 0)));
        return { index, score: s };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

export const reqText = (r: Pick<Requirement, 'title' | 'description'>) => `${r.title}. ${r.title}. ${r.description}`;

export function buildLibraryIndex(items: LibraryItem[]) {
  return new TfIdf(items.map((i) => reqText(i.req)));
}

export const REUSE_THRESHOLD = 0.4;
