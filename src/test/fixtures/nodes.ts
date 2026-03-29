import type { ExtraNode } from "@/types";

export const mockExtraNode: ExtraNode = {
  id: "node-1",
  name: "My SOCKS5 Proxy",
  node_type: "socks5",
  server: "192.168.1.100",
  port: 1080,
  refresh_url: null,
  raw_line: "My SOCKS5 Proxy = socks5, 192.168.1.100, 1080",
};

export const mockExtraNodes: ExtraNode[] = [mockExtraNode];
