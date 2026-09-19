import * as vscode from 'vscode';
import { REPO_URL } from './update';

/**
 * 「立即更新」：在 VS Code 终端里以 Task 形式运行随扩展一起分发的
 * scripts/self-update.sh（Windows 为 .ps1），由脚本完成
 * 下载最新源码 → npm install → 编译 → 打包 → 覆盖安装。
 *
 * 之所以走终端而不是 child_process：
 *   - 宿主代码保持「无 child_process / 无原生依赖」，.vsix 全平台通用；
 *   - npm install 这类长任务能实时看到日志（脚本自带进度界面）；
 *   - 安装完成后由扩展弹窗提示重载窗口。
 */

let updating = false;

/** 返回是否成功排入了更新任务。 */
export async function runSelfUpdate(context: vscode.ExtensionContext): Promise<boolean> {
  // 先占位再 await：否则并发点击会同时通过检查、重复排队
  if (updating) {
    void vscode.window.showInformationMessage('RopIDE 正在更新中，请查看终端里的进度。');
    return false;
  }
  updating = true;
  try {
    return await startUpdateTask(context);
  } finally {
    updating = false;
  }
}

async function startUpdateTask(context: vscode.ExtensionContext): Promise<boolean> {
  const isWin = process.platform === 'win32';
  const scriptName = isWin ? 'self-update.ps1' : 'self-update.sh';
  const scriptUri = vscode.Uri.joinPath(context.extensionUri, 'scripts', scriptName);

  try {
    await vscode.workspace.fs.stat(scriptUri);
  } catch {
    const pick = await vscode.window.showErrorMessage(
      `找不到更新脚本 scripts/${scriptName}，无法自动更新。可手动运行仓库里的 install 脚本，或从 GitHub 获取最新源码。`,
      '打开 GitHub'
    );
    if (pick === '打开 GitHub') {
      void vscode.env.openExternal(vscode.Uri.parse(REPO_URL));
    }
    return false;
  }

  const scriptPath = scriptUri.fsPath;
  const execution = isWin
    ? new vscode.ShellExecution('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath])
    : new vscode.ShellExecution('bash', [scriptPath]);

  const task = new vscode.Task(
    { type: 'ropide.selfUpdate' },
    vscode.TaskScope.Global,
    'RopIDE 更新',
    'RopIDE',
    execution
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true,
    echo: false,
    focus: true,
  };

  const finished = new Promise<number | undefined>((resolve) => {
    const sub = vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.execution.task === task) {
        sub.dispose();
        resolve(e.exitCode);
      }
    });
  });

  try {
    await vscode.tasks.executeTask(task);
  } catch (e) {
    void vscode.window.showErrorMessage(`无法启动更新任务：${(e as Error).message}`);
    return false;
  }

  const exitCode = await finished;

  if (exitCode === 0) {
    const pick = await vscode.window.showInformationMessage(
      'RopIDE 已更新到最新版本，重载窗口后生效。',
      '重载窗口'
    );
    if (pick === '重载窗口') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } else {
    void vscode.window.showErrorMessage(
      `RopIDE 更新失败（退出码 ${exitCode}），请查看终端里的日志。若持续失败，可运行仓库中的 install 脚本手动更新。`
    );
  }
  return true;
}
