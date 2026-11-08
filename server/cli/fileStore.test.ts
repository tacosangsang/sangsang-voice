import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { DirFileStore, FilePathError } from './fileStore';

test('DirFileStore는 폴더를 자동 생성하고 WAV만 상대 경로로 나열하며 기존 파일을 보존한다', async () => {
  const root = await mkdtemp(join(process.cwd(), '.cli-test-'));
  try {
    const out = join(root, 'out');
    const store = new DirFileStore(out);
    assert.deepEqual(await store.list(), []);
    await assert.rejects(readdir(out), { code: 'ENOENT' });
    const bytes = new Uint8Array([1, 2, 3]);
    await store.write('S01/앵커-v1.wav', bytes);
    await store.write('S05/토끼-v2.WAV', bytes);
    await writeFile(join(out, '설명.txt'), '설명');
    assert.deepEqual(await store.list(), ['S01/앵커-v1.wav', 'S05/토끼-v2.WAV']);
    assert.deepEqual(await readFile(join(out, 'S01/앵커-v1.wav')), Buffer.from(bytes));
    await assert.rejects(store.write('S01/앵커-v1.wav', new Uint8Array([9])), { code: 'EEXIST' });
    assert.deepEqual(await readFile(join(out, 'S01/앵커-v1.wav')), Buffer.from(bytes));
    await assert.rejects(store.write('../밖.wav', bytes), FilePathError);
    await assert.rejects(store.write(join(root, '밖.wav'), bytes), FilePathError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('DirFileStore는 출력 폴더 밖을 가리키는 링크로의 저장을 거절한다', async () => {
  const root = await mkdtemp(join(process.cwd(), '.cli-test-'));
  try {
    const out = join(root, 'out');
    const outside = join(root, 'outside');
    await mkdir(out);
    await mkdir(outside);
    await symlink(outside, join(out, 'S01'), 'junction');
    const store = new DirFileStore(out);

    await assert.rejects(store.write('S01/x.wav', new Uint8Array([1])), FilePathError);
    await assert.rejects(readFile(join(outside, 'x.wav')), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
