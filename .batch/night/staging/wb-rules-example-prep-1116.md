非越护栏准备（2026-11-16 06:22，读-only）
A. 独立复算 QA 基线（不自界面，按 UTF-8 字节读）
   .batch/night/staging/notice-current-1116.txt
   wc -c = 3468 ; md5 = 2bea7f8874991666ad37394ccebf232b ; len(chars) = 1504
   六块偏移 = 165 / 448 / 614 / 1108 / 1259 / 1437
   结论：与 QA 报值逐项一致，基线可独立复现。
B. 投后回查取数路径已跑通（只读 open，mode=ro）
   ~/.workbuddy/workbuddy.db 表 sessions 含 model 列
   语句：select id,model,status,created_at from sessions where cwd like '%dsh-group-rules-prompt%'
   现结果：1 行（8ac906da-8c7e-499a-8d42-e169c278bef1 / deepseek-v4.1-flash / completed / 1794777897642）
C. 不做清单：不投（护栏未放行）、不 --force、不出 v2（已冻结）、不改卡（第83行 model 已钉死）、不碰 origin
