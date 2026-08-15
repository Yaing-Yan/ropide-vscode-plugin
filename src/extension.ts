import * as vscode from 'vscode';
import { RopEditorProvider } from './ropEditorProvider';
import { newRopDocument, serializeRopDocument } from './rop';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RopEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(RopEditorProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ropide.newFile', () => createNewRopFile()),
    vscode.commands.registerCommand('ropide.compile', () => provider.postToActive('compile')),
    vscode.commands.registerCommand('ropide.showGadgets', () => provider.postToActive('show-gadgets'))
  );
}

export function deactivate(): void {}

async function createNewRopFile(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, 'untitled.rop')
    : undefined;

  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'Rop File': ['rop'] },
    saveLabel: 'Create',
    title: '新建 .rop 文件',
  });
  if (!uri) return;

  const data = newRopDocument();
  const bytes = Buffer.from(serializeRopDocument(data), 'utf8');
  try {
    await vscode.workspace.fs.writeFile(uri, bytes);
  } catch (e) {
    void vscode.window.showErrorMessage(`创建 .rop 文件失败：${(e as Error).message}`);
    return;
  }
  await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
}
