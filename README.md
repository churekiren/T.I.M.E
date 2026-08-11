# T.I.M.E. 時界異常事件處理局

兒童營隊用的探員登錄系統前端 MVP。資料只保存在目前瀏覽器的 `localStorage`，不包含任何真名、照片辨識、排名或社群功能。

## 啟動

一般使用者可直接雙擊專案根目錄的 `啟動 T.I.M.E..bat`。啟動器會在第一次使用時自動安裝必要元件、啟動網站並開啟預設瀏覽器。

開發者也可使用：

```bash
npm install
npm run dev
```

建置正式版本：

```bash
npm run build
npm run preview
```

## 路由

- `/` 中央入口
- `/register` 探員登錄
- `/upload` 徽章拍照、上傳與裁切
- `/wall` 現場投影識別牆
- `/agents` 探員檔案查詢
- `/agent/:id` 個人識別檔案

## 資料層

所有讀寫集中於 `src/data/agentStore.js`。未來接 Supabase、Firebase 或自建 API 時，請以相同方法介面替換此檔，並將徽章 base64 改存物件儲存服務。

正式局徽請直接覆蓋 `public/assets/time-emblem.png`，全站均引用 `/assets/time-emblem.png`。
