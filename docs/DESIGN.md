# Dashboard design

The VHPMS shell keeps Vidmar blue `#1454c0`. This pass follows three public guides:

- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): one type hierarchy, no decorative repetition, and no letter marks standing in for a real icon.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines): 4.5:1 text contrast, visible focus, 40px tab targets, icon buttons named for assistive tech, and tabular figures on money.
- [GitHub Primer](https://primer.style/product/getting-started/foundations/): an 8px spacing scale (`4, 8, 12, 16, 24, 32`), one card per fact, and an icon plus a word for navigation.

Icons are Lucide (`lucide-react`), one set for the sidebar, section tabs, and table columns. Overview states each total once in the tiles. Its charts are the breakdowns: income against expenses, expenses by category, the monthly flow, and status donuts for operations and clients. Funds holds the month figures, category donuts, and daily lines. Accounts holds the bank card. Family Accounts and Customers hold their tables.
