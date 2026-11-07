import { parseArgs } from 'node:util';
import type { ScriptOrigin } from '../../src/script/source';
import type { DialogueLanguage } from '../../src/shared/language';
import { CliArgumentError } from './dubArgs';
import type { LineSelection } from './dubArgs';

export type ScriptLintOptions = LineSelection & {
  readonly source: ScriptOrigin;
  readonly language: DialogueLanguage;
  readonly json: boolean;
  readonly strict: boolean;
  readonly all: boolean;
};

const ARGUMENT_OPTIONS = {
  source: { type: 'string', default: 'bundled' },
  scene: { type: 'string', multiple: true },
  cut: { type: 'string', multiple: true },
  speaker: { type: 'string', multiple: true },
  lang: { type: 'string', default: 'ko' },
  json: { type: 'boolean', default: false },
  strict: { type: 'boolean', default: false },
  all: { type: 'boolean', default: false },
} as const;

export function parseScriptLintArgs(args: string[]): ScriptLintOptions {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof ARGUMENT_OPTIONS }>>;
  try {
    parsed = parseArgs({ args, strict: true, allowPositionals: false, options: ARGUMENT_OPTIONS });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CliArgumentError('인자 형식이 잘못되었습니다. 옵션 이름과 필요한 값을 확인하세요.');
    }
    throw error;
  }
  const { values } = parsed;
  if (values.source !== 'bundled' && values.source !== 'notion') {
    throw new CliArgumentError('--source는 bundled 또는 notion이어야 합니다.');
  }
  if (values.lang !== 'ko' && values.lang !== 'en') {
    throw new CliArgumentError('--lang은 ko 또는 en이어야 합니다.');
  }
  const scenes = values.scene ?? [];
  const cuts = values.cut ?? [];
  const speakers = values.speaker ?? [];
  if ([...scenes, ...cuts, ...speakers].some((value) => !value.trim())) {
    throw new CliArgumentError('씬·컷·화자는 빈 값일 수 없습니다.');
  }
  return {
    source: values.source, scenes, cuts, speakers, language: values.lang,
    json: values.json, strict: values.strict, all: values.all,
  };
}
