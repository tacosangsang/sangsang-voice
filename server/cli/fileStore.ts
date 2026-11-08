import { mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface FileStore {
  list(): Promise<string[]>;
  write(relativePath: string, bytes: Uint8Array): Promise<void>;
}

export class FilePathError extends Error {
  readonly name = 'FilePathError';
}

export class DirFileStore implements FileStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async list(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { recursive: true, withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && /\.wav$/i.test(entry.name))
        .map((entry) => relative(this.root, join(entry.parentPath, entry.name)).replaceAll('\\', '/')).sort();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    const target = resolve(this.root, relativePath);
    const inside = relative(this.root, target);
    if (isAbsolute(relativePath) || isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) {
      throw new FilePathError('저장 경로는 출력 폴더 안에 있어야 합니다.');
    }
    await mkdir(dirname(target), { recursive: true });
    const realInside = relative(await realpath(this.root), await realpath(dirname(target)));
    if (isAbsolute(realInside) || realInside === '..' || realInside.startsWith(`..${sep}`)) {
      throw new FilePathError('저장 경로는 출력 폴더 안에 있어야 합니다.');
    }
    // 다른 실행이 같은 버전을 먼저 저장해도 기존 음성을 덮어쓰지 않는다.
    await writeFile(target, bytes, { flag: 'wx' });
  }
}
