/**
 * CasioEmuMsvc MCP 客户端（极简）。
 *
 * CasioEmuMsvc 的 McpPlugin 通过 Streamable HTTP JSON-RPC 暴露调试接口：
 *   - GET  http://127.0.0.1:3001/health   （检测模拟器是否运行）
 *   - POST http://127.0.0.1:3001/mcp      （initialize / tools/call）
 *
 * 参考：ropide-python 的 CEM_API/cem/mcp.py 与 cem/emu.py。
 * 本插件仅做「覆写」：write_memory，不按键、不开关机。
 */

const MCP_BASE = 'http://127.0.0.1:3001';
const MCP_PROTOCOL_VERSION = '2025-11-25';
const NOT_RUNNING = '找不到正在运行的CasioEmuMsvc，或者进程不支持MCP';

export type EmuWriteResult = { ok: true } | { ok: false; error: string };

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

async function emuHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MCP_BASE}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as Record<string, unknown>;
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

async function emuInitialize(): Promise<string | null> {
  try {
    const res = await fetch(`${MCP_BASE}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'ropide-vscode', version: '0.1.0' },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.headers.get('MCP-Session-Id');
  } catch {
    return null;
  }
}

/** 向模拟器内存写入字节（仅覆写，不做其它操作）。 */
export async function emuWrite(address: number, bytes: number[]): Promise<EmuWriteResult> {
  if (!(await emuHealth())) {
    return { ok: false, error: NOT_RUNNING };
  }

  const session = await emuInitialize();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (session) headers['MCP-Session-Id'] = session;

    const res = await fetch(`${MCP_BASE}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'write_memory',
          arguments: { address, bytes },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { ok: false, error: `MCP 返回 HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data && data.error) {
      const e = data.error as Record<string, unknown>;
      return { ok: false, error: String(e.message || 'MCP 错误') };
    }
    const result = data?.result as Record<string, unknown> | undefined;
    if (result && result.isError) {
      const content = result.content as Array<{ text?: string }> | undefined;
      const text = content && content[0] ? content[0].text : undefined;
      return { ok: false, error: text || '写入失败' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
