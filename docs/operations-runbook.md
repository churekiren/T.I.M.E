# T.I.M.E. 營運檢查手冊

## Supabase 唯讀健康檢查

GitHub Actions workflow `Supabase read-only health check` 每天 UTC 03:17 執行，也可在 GitHub repository 的 **Actions** 頁面選取該 workflow，按 **Run workflow** 手動執行。

檢查使用既有 GitHub Actions Secrets：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

它只以 publishable key 呼叫現有的 `get_session_wall` RPC，並傳入不對應任何正式梯次的保留識別值。預期結果是 HTTP 200 與空 JSON 陣列；workflow 不會輸出 key、回應資料或探員資訊，也不使用 `service_role`。

## 失敗排查

1. 在 GitHub **Actions → Supabase read-only health check** 查看失敗執行。
2. 若顯示必要 Secrets 缺少，檢查 repository 的 **Settings → Secrets and variables → Actions**，確認上述兩個 Secret 仍存在；不要把值貼到 Issue、log 或程式碼。
3. HTTP `000` 通常表示連線逾時、DNS 或網路錯誤；稍後手動重跑一次。
4. HTTP `401` 或 `403` 時，檢查 publishable key 是否已輪替、Secret 是否仍正確，以及 RPC execute 權限是否被變更。
5. HTTP `404` 時，檢查 Supabase URL 是否指向正確 Project，以及 `get_session_wall` RPC 是否仍存在。
6. HTTP `5xx` 或持續逾時時，到 Supabase Dashboard 確認 Project 狀態與服務事件；若 Project 已暫停，先由 Dashboard 恢復後再重跑。
7. HTTP 200 但回應格式不符時，不要將 response body 貼到公開紀錄；先檢查 RPC contract 是否被修改。

## 限制與備份

- GitHub 排程可能因平台負載而延遲，不能視為精準計時器。
- 公開 repository 若 60 天沒有活動，GitHub 可能自動停用 scheduled workflow；應定期查看 Actions 是否仍啟用。
- 此唯讀檢查只能降低 Supabase Free Project 再次因低活動暫停的機率，不能保證永久在線，也不能取代正式監控。
- Database、Auth 與 Storage 必須另行備份。Database dump 不包含 Storage 實際檔案；正式徽章物件必須獨立保存。
