import { parseArgs } from 'node:util';
import type { DialogueLanguage } from '../../src/shared/language';
import type { ScriptOrigin } from '../../src/script/source';

export type LineSelection = {
  readonly scenes: readonly string[];
  readonly cuts: readonly string[];
  readonly speakers: readonly string[];
};

export type DubOptions = LineSelection & {
  readonly source: ScriptOrigin;
  readonly voiceName: string;
  readonly stylePrompt: string;
  readonly language: DialogueLanguage;
  readonly modelPreference?: string;
  readonly out: string;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly batch: boolean;
};

export class CliArgumentError extends Error {
  readonly name = 'CliArgumentError';
}

const ARGUMENT_OPTIONS = {
  source: { type: 'string', default: 'bundled' },
  scene: { type: 'string', multiple: true },
  cut: { type: 'string', multiple: true },
  speaker: { type: 'string', multiple: true },
  voice: { type: 'string' },
  style: { type: 'string', default: '' },
  lang: { type: 'string', default: 'ko' },
  'model-preference': { type: 'string' },
  out: { type: 'string', default: 'out' },
  force: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  batch: { type: 'boolean', default: false },
} as const;

export function parseDubArgs(args: string[]): DubOptions {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof ARGUMENT_OPTIONS }>>;
  try {
    parsed = parseArgs({
      args, strict: true, allowPositionals: false,
      options: ARGUMENT_OPTIONS,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CliArgumentError('인자 형식이 잘못되었습니다. 옵션 이름과 필요한 값을 확인하세요.');
    }
    throw error;
  }
  const { values } = parsed;
  if (!values.voice?.trim()) throw new CliArgumentError('--voice <이름>은 필수입니다.');
  if (values.source !== 'bundled' && values.source !== 'notion') {
    throw new CliArgumentError('--source는 bundled 또는 notion이어야 합니다.');
  }
  if (values.lang !== 'ko' && values.lang !== 'en') {
    throw new CliArgumentError('--lang은 ko 또는 en이어야 합니다.');
  }
  const scenes = values.scene ?? [];
  const cuts = values.cut ?? [];
  const speakers = values.speaker ?? [];
  if ([...scenes, ...cuts, ...speakers, values.out, values['model-preference'] ?? '기본'].some((s) => !s.trim())) {
    throw new CliArgumentError('씬·컷·화자·출력 폴더·모델 이름은 빈 값일 수 없습니다.');
  }
  if (speakers.length > 1) throw new CliArgumentError('--speaker는 한 화자만 지정하세요.');
  return {
    source: values.source, scenes, cuts, speakers, voiceName: values.voice.trim(),
    stylePrompt: values.style, language: values.lang, modelPreference: values['model-preference'],
    out: values.out, force: values.force, dryRun: values['dry-run'], batch: values.batch,
  };
}
