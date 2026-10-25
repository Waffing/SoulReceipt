import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "精神状态小票机 SoulReceipt · 赛博便利店确诊单",
  description:
    "打印一张你的精神状态小票：内耗明细、精神税、确诊等级与撕票仪式感。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="thermal-font antialiased">{children}</body>
    </html>
  );
}
