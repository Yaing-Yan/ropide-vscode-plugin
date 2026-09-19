import * as vscode from 'vscode';

const KEY = 'ropide.recentFiles';
const MAX = 8;

export interface RecentEntry {
  /** 文件 URI 字符串（vscode.Uri.toString()），用于精确重新打开 */
  uri: string;
  /** 文件名（含扩展名），用于展示 */
  name: string;
  /** 上次打开的时间戳（ms） */
  at: number;
}

/** 记录一次 .rop 打开：置顶、去重、限量。 */
export function recordRecentFile(context: vscode.ExtensionContext, uri: vscode.Uri): void {
  const key = uri.toString();
  const name = uri.path.split('/').pop() || key;
  const prev = context.globalState.get<RecentEntry[]>(KEY, []);
  const next: RecentEntry[] = [
    { uri: key, name, at: Date.now() },
    ...prev.filter((e) => e.uri !== key),
  ].slice(0, MAX);
  void context.globalState.update(KEY, next);
}

export function getRecentFiles(context: vscode.ExtensionContext): RecentEntry[] {
  return context.globalState.get<RecentEntry[]>(KEY, []);
}

/** 从最近列表中移除一项（例如文件已不存在）。 */
export function removeRecentFile(context: vscode.ExtensionContext, uriStr: string): void {
  const prev = context.globalState.get<RecentEntry[]>(KEY, []);
  void context.globalState.update(KEY, prev.filter((e) => e.uri !== uriStr));
}
