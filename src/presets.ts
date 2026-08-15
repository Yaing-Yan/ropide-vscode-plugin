import { RopGadget } from "./rop";

// 从 ropide-python 内置预设移植（VerF / VerC）。
export const VERF_GADGETS: RopGadget[] = [
  {
    "name": "pop-er0",
    "addr": "121A8",
    "desc": "赋值 ER0",
    "tags": []
  },
  {
    "name": "pop-er2",
    "addr": "18814",
    "desc": "赋值 ER2",
    "tags": []
  },
  {
    "name": "pop-er4",
    "addr": "1827C",
    "desc": "赋值 ER4",
    "tags": []
  },
  {
    "name": "pop-er6",
    "addr": "139EE",
    "desc": "赋值 ER6",
    "tags": []
  },
  {
    "name": "pop-er8",
    "addr": "0C0F0",
    "desc": "赋值 ER8",
    "tags": []
  },
  {
    "name": "pop-er10",
    "addr": "0C29C",
    "desc": "赋值 ER10",
    "tags": []
  },
  {
    "name": "pop-er12",
    "addr": "21532",
    "desc": "赋值 ER12",
    "tags": []
  },
  {
    "name": "pop-er14",
    "addr": "20D72",
    "desc": "赋值 ER14",
    "tags": []
  },
  {
    "name": "pop-xr0",
    "addr": "16134",
    "desc": "赋值 XR0",
    "tags": []
  },
  {
    "name": "pop-xr4",
    "addr": "16D78",
    "desc": "赋值 XR4",
    "tags": []
  },
  {
    "name": "pop-xr8",
    "addr": "13846",
    "desc": "赋值 XR8",
    "tags": []
  },
  {
    "name": "pop-xr12",
    "addr": "1D52C",
    "desc": "赋值 XR12",
    "tags": []
  },
  {
    "name": "pop-qr0",
    "addr": "130E2",
    "desc": "赋值 QR0",
    "tags": []
  },
  {
    "name": "pop-qr8",
    "addr": "13236",
    "desc": "赋值 QR8",
    "tags": []
  },
  {
    "name": "pop-all",
    "addr": "22390",
    "desc": "赋值 QR8, QR0",
    "tags": []
  },
  {
    "name": "rt-fix",
    "addr": "2BAD4",
    "desc": "修复 RT 返回问题",
    "tags": []
  },
  {
    "name": "byte-set",
    "addr": "203D2",
    "desc": "内存赋值 [ER0] = R2",
    "tags": []
  },
  {
    "name": "mem-add",
    "addr": "08F90",
    "desc": "内存地址加法 [ER8] += ER2",
    "tags": [
      {
        "name": "XR8",
        "color": "blue"
      }
    ]
  },
  {
    "name": "strcpy",
    "addr": "203C8",
    "desc": "字符串复制 [ER2] -> [ER0]\n碰到00停止复制",
    "tags": []
  },
  {
    "name": "screen-on",
    "addr": "0937C",
    "desc": "开启屏幕显示",
    "tags": [
      {
        "name": "RT",
        "color": "orange"
      }
    ]
  },
  {
    "name": "refresh-ddd4",
    "addr": "08772",
    "desc": "刷新DDD4屏幕缓冲区",
    "tags": []
  },
  {
    "name": "clear-ddd4",
    "addr": "07F6C",
    "desc": "清除DDD4屏幕缓冲区",
    "tags": []
  },
  {
    "name": "sleep",
    "addr": "091D8",
    "desc": "延时 R1÷0x1E 秒",
    "tags": []
  },
  {
    "name": "jump-e14",
    "addr": "10740",
    "desc": "重设SP为[ER14]\n注意会 POP ER14",
    "tags": [
      {
        "name": "ER14",
        "color": "blue"
      }
    ]
  },
  {
    "name": "jump-q8",
    "addr": "12D34",
    "desc": "重设SP为[ER14]\n注意会 POP QR8",
    "tags": [
      {
        "name": "QR8",
        "color": "blue"
      }
    ]
  },
  {
    "name": "jump-q8q0",
    "addr": "2238E",
    "desc": "重设SP为[ER14]\n注意会 POP QR8、QR0",
    "tags": [
      {
        "name": "QR8",
        "color": "blue"
      },
      {
        "name": "QR0",
        "color": "blue"
      }
    ]
  },
  {
    "name": "print-0x1y",
    "addr": "0828A",
    "desc": "打印一行文本内容（可变x轴偏移）\nR0：x轴偏移\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-0ynf",
    "addr": "221AE",
    "desc": "打印一行文本内容（固定字体）\nR0：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-1ysf",
    "addr": "222B4",
    "desc": "打印一行文本内容（字体随设置改变）\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-0f1y",
    "addr": "221BE",
    "desc": "打印一行文本内容（可变字体）\nR0：字体编码\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "debug",
    "addr": "22110",
    "desc": "屏幕显示Press AC后卡死\n无需开屏幕，通常用于测试程序是否被执行",
    "tags": [
      {
        "name": "卡死",
        "color": "orange"
      }
    ]
  }
];

export const VERC_GADGETS: RopGadget[] = [
  {
    "name": "pop-er0",
    "addr": "121A8",
    "desc": "赋值 ER0",
    "tags": []
  },
  {
    "name": "pop-er2",
    "addr": "18814",
    "desc": "赋值 ER2",
    "tags": []
  },
  {
    "name": "pop-er4",
    "addr": "1827C",
    "desc": "赋值 ER4",
    "tags": []
  },
  {
    "name": "pop-er6",
    "addr": "139EE",
    "desc": "赋值 ER6",
    "tags": []
  },
  {
    "name": "pop-er8",
    "addr": "0C06C",
    "desc": "赋值 ER8",
    "tags": []
  },
  {
    "name": "pop-er10",
    "addr": "0C218",
    "desc": "赋值 ER10",
    "tags": []
  },
  {
    "name": "pop-er12",
    "addr": "21532",
    "desc": "赋值 ER12",
    "tags": []
  },
  {
    "name": "pop-er14",
    "addr": "20D72",
    "desc": "赋值 ER14",
    "tags": []
  },
  {
    "name": "pop-xr0",
    "addr": "16134",
    "desc": "赋值 XR0",
    "tags": []
  },
  {
    "name": "pop-xr4",
    "addr": "16D78",
    "desc": "赋值 XR4",
    "tags": []
  },
  {
    "name": "pop-xr8",
    "addr": "13846",
    "desc": "赋值 XR8",
    "tags": []
  },
  {
    "name": "pop-xr12",
    "addr": "1D52C",
    "desc": "赋值 XR12",
    "tags": []
  },
  {
    "name": "pop-qr0",
    "addr": "130E2",
    "desc": "赋值 QR0",
    "tags": []
  },
  {
    "name": "pop-qr8",
    "addr": "13236",
    "desc": "赋值 QR8",
    "tags": []
  },
  {
    "name": "pop-all",
    "addr": "2237C",
    "desc": "赋值 QR8, QR0",
    "tags": []
  },
  {
    "name": "rt-fix",
    "addr": "2B948",
    "desc": "修复 RT 返回问题",
    "tags": []
  },
  {
    "name": "byte-set",
    "addr": "203D2",
    "desc": "内存赋值 [ER0] = R2",
    "tags": []
  },
  {
    "name": "mem-add",
    "addr": "08F24",
    "desc": "内存地址加法 [ER8] += ER2",
    "tags": [
      {
        "name": "XR8",
        "color": "blue"
      }
    ]
  },
  {
    "name": "strcpy",
    "addr": "203C8",
    "desc": "字符串复制 [ER2] -> [ER0]\n碰到00停止复制",
    "tags": []
  },
  {
    "name": "screen-on",
    "addr": "09310",
    "desc": "开启屏幕显示",
    "tags": [
      {
        "name": "RT",
        "color": "orange"
      }
    ]
  },
  {
    "name": "refresh-ddd4",
    "addr": "08706",
    "desc": "刷新DDD4屏幕缓冲区",
    "tags": []
  },
  {
    "name": "clear-ddd4",
    "addr": "07F00",
    "desc": "清除DDD4屏幕缓冲区",
    "tags": []
  },
  {
    "name": "sleep",
    "addr": "0916C",
    "desc": "延时 R1÷0x1E 秒",
    "tags": []
  },
  {
    "name": "jump-e14",
    "addr": "10740",
    "desc": "重设SP为[ER14]\n注意会 POP ER14",
    "tags": [
      {
        "name": "ER14",
        "color": "blue"
      }
    ]
  },
  {
    "name": "jump-q8",
    "addr": "12D34",
    "desc": "重设SP为[ER14]\n注意会 POP QR8",
    "tags": [
      {
        "name": "QR8",
        "color": "blue"
      }
    ]
  },
  {
    "name": "jump-q8q0",
    "addr": "2237A",
    "desc": "重设SP为[ER14]\n注意会 POP QR8、QR0",
    "tags": [
      {
        "name": "QR8",
        "color": "blue"
      },
      {
        "name": "QR0",
        "color": "blue"
      }
    ]
  },
  {
    "name": "print-0x1y",
    "addr": "0821E",
    "desc": "打印一行文本内容（可变x轴偏移）\nR0：x轴偏移\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-0ynf",
    "addr": "221AE",
    "desc": "打印一行文本内容（固定字体）\nR0：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-1ysf",
    "addr": "222A8",
    "desc": "打印一行文本内容（字体随设置改变）\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "print-0f1y",
    "addr": "221B2",
    "desc": "打印一行文本内容（可变字体）\nR0：字体编码\nR1：y轴偏移\nER2：文本内容指针",
    "tags": []
  },
  {
    "name": "debug",
    "addr": "22104",
    "desc": "屏幕显示Press AC后卡死\n无需开屏幕，通常用于测试程序是否被执行",
    "tags": [
      {
        "name": "卡死",
        "color": "orange"
      }
    ]
  }
];
