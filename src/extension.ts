import * as vscode from 'vscode';
import { RopEditorProvider } from './ropEditorProvider';
import {
  RopDocumentData,
  RopGadget,
  newRopDocument,
  serializeRopDocument,
  parseGadgetsJson,
  DEFAULT_LEFT_ADDRESS,
  DEFAULT_RIGHT_ADDRESS,
  IDE_VERSION,
} from './rop';
import { VERF_GADGETS, VERC_GADGETS } from './presets';
import { showWelcome } from './welcome';
import { marketUnread } from './marketState';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new RopEditorProvider(context);
  marketUnread.init(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(RopEditorProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand('ropide.newFile', () => createNewRopFile()),
    vscode.commands.registerCommand('ropide.openFile', () => openRopFile()),
    vscode.commands.registerCommand('ropide.compile', () => provider.postToActive('compile')),
    vscode.commands.registerCommand('ropide.showGadgets', () => provider.postToActive('show-gadgets')),
    vscode.commands.registerCommand('ropide.openMarket', () => provider.postToActive('show-market')),
    vscode.commands.registerCommand('ropide.about', () => showWelcome(context))
  );

  // 首次安装 / 重装（globalState 被清除）时显示欢迎页
  if (!context.globalState.get<boolean>('ropide.welcomeShown')) {
    void context.globalState.update('ropide.welcomeShown', true);
    showWelcome(context);
  }
}

export function deactivate(): void {}

async function openRopFile(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'Rop File': ['rop'] },
    title: '打开 .rop 文件',
  });
  if (!uris || uris.length === 0) return;
  await vscode.commands.executeCommand('vscode.openWith', uris[0], RopEditorProvider.viewType);
}

async function createNewRopFile(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, 'untitled.rop')
    : undefined;

  // 1. 文件名 / 保存路径
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'Rop File': ['rop'] },
    saveLabel: 'Create',
    title: '新建 .rop 文件',
  });
  if (!uri) return;

  // 2. 左侧起始地址
  const left = await promptAddress('左侧起始地址（例如 E9E0）', DEFAULT_LEFT_ADDRESS);
  if (left === undefined) return;

  // 3. 右侧起始地址
  const right = await promptAddress('右侧起始地址（例如 D710）', DEFAULT_RIGHT_ADDRESS);
  if (right === undefined) return;

  // 4. gadgets 来源（VerF / VerC / 导入 gadgets.json / 空）
  const gadgets = await chooseGadgets();
  if (gadgets === undefined) return;

  const fileName = uri.path.split('/').pop() || 'untitled.rop';
  const data: RopDocumentData = {
    input: `// ${fileName}\n`,
    gadgets,
    leftStartAddress: left,
    rightStartAddress: right,
    ideVersion: IDE_VERSION,
  };

  const bytes = Buffer.from(serializeRopDocument(data), 'utf8');
  try {
    await vscode.workspace.fs.writeFile(uri, bytes);
  } catch (e) {
    void vscode.window.showErrorMessage(`创建 .rop 文件失败：${(e as Error).message}`);
    return;
  }
  await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
}

async function promptAddress(prompt: string, def: string): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    prompt,
    value: def,
    ignoreFocusOut: true,
    validateInput: (v) => {
      const s = v.trim().toUpperCase().replace(/^0X/, '');
      if (!s) return '地址不能为空';
      if (!/^[0-9A-F]{1,5}$/.test(s)) return '地址必须是十六进制（最多 5 位），例如 E9E0';
      return undefined;
    },
  });
  if (input === undefined) return undefined;
  return input.trim().toUpperCase().replace(/^0X/, '');
}

async function chooseGadgets(): Promise<RopGadget[] | undefined> {
  const options = [
    { label: 'CASIO fx-991 CN X VerF（内置预设）', id: 'verf' as const },
    { label: 'CASIO fx-991 CN X VerC（内置预设）', id: 'verc' as const },
    { label: '导入 gadgets.json…', id: 'import' as const },
    { label: '空 gadgets', id: 'empty' as const },
  ];
  const pick = await vscode.window.showQuickPick(
    options.map((o) => o.label),
    { placeHolder: '选择 gadgets 来源', title: 'Gadgets', ignoreFocusOut: true }
  );
  if (pick === undefined) return undefined;
  const opt = options.find((o) => o.label === pick);
  switch (opt?.id) {
    case 'verf':
      return VERF_GADGETS;
    case 'verc':
      return VERC_GADGETS;
    case 'empty':
      return [];
    case 'import':
      return importGadgetsFile();
    default:
      return undefined;
  }
}

async function importGadgetsFile(): Promise<RopGadget[] | undefined> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'Gadgets JSON': ['json'] },
    title: '选择 gadgets.json',
  });
  if (!uris || uris.length === 0) return undefined;
  try {
    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const text = Buffer.from(bytes).toString('utf8');
    const result = parseGadgetsJson(text);
    if (!result.ok) {
      void vscode.window.showErrorMessage(`导入 gadgets.json 失败：${result.error}`);
      return undefined;
    }
    return result.gadgets;
  } catch (e) {
    void vscode.window.showErrorMessage(`读取 gadgets.json 失败：${(e as Error).message}`);
    return undefined;
  }
}
