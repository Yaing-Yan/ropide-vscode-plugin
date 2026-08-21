import * as vscode from 'vscode';

/**
 * 关闭指定 uri 的所有已打开标签页（文本 / 自定义编辑器）。
 *
 * 用途：`vscode.workspace.fs.writeFile` 覆盖写盘后，已打开的标签页不会自动
 * 从磁盘重新加载（tab 里的 document 仍是旧内容）。先关闭再重新 openWith，
 * 可保证覆盖保存同名 .rop 后打开的是新内容。
 */
export async function closeTabIfOpen(uri: vscode.Uri): Promise<void> {
  const uriStr = uri.toString();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs.slice()) {
      const input = tab.input;
      const tabUri =
        input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom
          ? input.uri
          : undefined;
      if (tabUri && tabUri.toString() === uriStr) {
        await vscode.window.tabGroups.close(tab, true);
      }
    }
  }
}