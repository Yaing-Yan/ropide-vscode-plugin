/**
 * CasioEmuMsvc RAM 覆写（外部进程内存方式）。
 *
 * 通过 ropide-python 同款的 casioemu_ram.py 工具，直接对正在运行的
 * CasioEmuMsvc 进程做内存写入（ptrace / ReadProcessMemory / task_for_pid），
 * 不依赖 MCP 插件。
 *
 * 一次性命令等价于：
 *   python3 casioemu_ram.py write 0xE9E0 01 02 03 ... [--pid N] [--model-dir DIR]
 */

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type EmuWriteResult = { ok: true; message: string } | { ok: false; error: string };

export interface EmuOptions {
  script: string;
  python: string;
  modelDir?: string;
  pid?: number;
}

/** 解析 hex 字符串（容忍空格 / 0x 前缀 / 分隔符），返回字节数组；非法返回 null。 */
export function parseHexBytes(s: string): number[] | null {
  const cleaned = String(s).replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) {
    return null;
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
  }
  return bytes;
}

/** 定位 casioemu_ram.py（优先用设置里配置的路径，其次常见位置）。 */
export function resolveRamScript(configured: string): string {
  if (configured && fs.existsSync(configured)) {
    return configured;
  }
  const home = os.homedir();
  const candidates = [
    path.join(home, 'casioemu', 'tools', 'casioemu_ram.py'),
    path.join(home, 'casioemu', 'casioemu_ram.py'),
    path.join(home, 'tools', 'casioemu_ram.py'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return configured || candidates[0];
}

/** 向模拟器 RAM 写入字节（仅覆写，不做其它操作）。 */
export function emuWrite(address: number, bytes: number[], opts: EmuOptions): Promise<EmuWriteResult> {
  const hexArgs = bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0'));
  const args = ['write', `0x${address.toString(16).toUpperCase()}`, ...hexArgs];
  if (opts.modelDir) {
    args.push('--model-dir', opts.modelDir);
  }
  if (opts.pid) {
    args.push('--pid', String(opts.pid));
  }

  return new Promise((resolve) => {
    execFile(
      opts.python,
      [opts.script, ...args],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = `${stdout || ''}\n${stderr || ''}`;
        if (!err) {
          resolve({ ok: true, message: out.trim() });
        } else {
          resolve({ ok: false, error: mapEmuError(out, err) });
        }
      }
    );
  });
}

function mapEmuError(output: string, err: unknown): string {
  const text = output.trim();
  if (text.includes('未找到运行中的 CasioEmuMsvc')) {
    return '找不到正在运行的CasioEmuMsvc';
  }
  if (text.includes('ptrace ATTACH 失败')) {
    return 'ptrace 连接失败：请执行 `echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope`，或用 sudo 运行';
  }
  if (text.includes('ram.dmp')) {
    return '找不到 ram.dmp（请先让模拟器运行并生成 RAM 快照）';
  }
  const m = text.match(/错误[:：]\s*(.+)/);
  if (m) {
    return m[1].trim();
  }
  if (text.includes('ENOENT')) {
    return '找不到 Python 或 casioemu_ram.py，请在设置 ropide.casioemuRamScript / ropide.casioemuPython 中指定';
  }
  const first = text.split('\n').map((s) => s.trim()).filter(Boolean)[0];
  return first || ((err as Error)?.message) || '覆写失败';
}
