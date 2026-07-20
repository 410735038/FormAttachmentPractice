# Form Attachment Practice

React + Vite 前端、Spring Boot 3 後端、SQLite 資料儲存，以及 `Attachments/{attId}` 實體附件儲存。

這個專案建議用 Docker 啟動。Docker 會負責 build 前端、build 後端，並把前端打包結果放進 Spring Boot 裡一起啟動，所以新電腦不需要另外安裝 Node.js、npm、Java 或 Maven。

## 專案結構

```txt
FormAttachmentPractice/
  Attachments/          # 實際附件存放位置，依 attId 分資料夾
  data/                 # Docker 啟動後的 SQLite DB 掛載位置
  DesignIdeas/          # 需求與設計想法
  src/
    frontend/           # React + Vite
    backend/            # Spring Boot 3
  Dockerfile
```

## 新電腦啟動步驟

### 1. 安裝 Docker

請先安裝並啟動 Docker Desktop：

```txt
https://www.docker.com/products/docker-desktop/
```

安裝完成後，確認 Docker daemon 有啟動：

```powershell
docker --version
docker ps
```

如果 `docker ps` 可以正常列出表格，代表 Docker 可以使用。

### 2. 進入專案根目錄

請在 PowerShell 進入此專案資料夾，也就是有 `Dockerfile` 的那一層：

```powershell
cd C:\Users\Nene\Projects\FormAttachmentPractice
```

如果是在另一台電腦，請改成該電腦上的實際專案路徑。

### 3. 建立本機資料夾

`Attachments` 用來保存附件檔案，`data` 用來保存 SQLite DB。這兩個資料夾會掛載進 Docker container，讓 container 重建後資料仍保留。

```powershell
mkdir Attachments -Force
mkdir data -Force
```

### 4. Build Docker image

```powershell
docker build -t form-attachment-practice .
```

這一步會做幾件事：

- 安裝前端 npm 套件
- 執行前端 `npm run build`
- 把前端 `dist` 放進 Spring Boot static resources
- 執行後端 Maven package
- 產生 Docker image：`form-attachment-practice`

第一次 build 會比較久，因為要下載 Node、Maven、Java base image 和套件。

### 5. 啟動服務

```powershell
docker run --rm --name form-attachment-practice -p 8080:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

看到 Spring Boot 啟動完成後，開啟：

```txt
http://localhost:8080
```

第一次進入系統後，如果沒有資料，可以按畫面上的「建立範例資料」按鈕。範例資料會建立多張表單，每張表單有三個分頁，每個分頁都有測試 rows。

## 背景啟動

如果不想讓 PowerShell 視窗卡住，可以用背景模式：

```powershell
docker run -d --name form-attachment-practice -p 8080:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

查看狀態：

```powershell
docker ps
```

查看 log：

```powershell
docker logs -f form-attachment-practice
```

停止服務：

```powershell
docker stop form-attachment-practice
```

如果要重新啟動同名 container，先移除舊 container：

```powershell
docker rm form-attachment-practice
```

或直接強制移除：

```powershell
docker rm -f form-attachment-practice
```

## 更新程式後重新啟動

如果修改了程式碼，請重新 build image：

```powershell
docker build -t form-attachment-practice .
```

如果目前已有 container 在跑，先停止並移除：

```powershell
docker rm -f form-attachment-practice
```

再重新啟動：

```powershell
docker run -d --name form-attachment-practice -p 8080:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

## 資料保存位置

Docker container 內部使用：

```txt
/app/Attachments
/app/data/form_attachment.db
```

透過 volume 掛載，實際會保存到專案根目錄：

```txt
Attachments/
data/form_attachment.db
```

因此：

- 刪除 container 不會刪除附件與 SQLite DB。
- 刪除 `data/form_attachment.db` 會重置資料庫。
- 刪除 `Attachments/` 會刪除已上傳附件實體檔案。

## 常見問題

### localhost:8080 無法連線

先確認 container 是否正在執行：

```powershell
docker ps
```

如果沒有看到 `form-attachment-practice`，請重新啟動：

```powershell
docker run -d --name form-attachment-practice -p 8080:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

如果 container 有啟動但仍無法連線，查看 log：

```powershell
docker logs form-attachment-practice
```

### 8080 port 被占用

可以改成本機其他 port，例如 8081：

```powershell
docker run -d --name form-attachment-practice -p 8081:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

然後開：

```txt
http://localhost:8081
```

### 想重置測試資料

停止 container：

```powershell
docker rm -f form-attachment-practice
```

刪除 SQLite DB：

```powershell
Remove-Item .\data\form_attachment.db
```

重新啟動後，進畫面按「建立範例資料」。

## 本機開發模式

如果你想不用 Docker、分開跑前後端，需要安裝：

- Node.js 22+
- npm
- Java 21+
- Maven 3.9+

前端：

```powershell
cd src/frontend
npm install
npm run dev
```

前端 dev server 預設是：

```txt
http://localhost:5173
```

後端：

```powershell
cd src/backend
mvn spring-boot:run
```

後端 API 預設是：

```txt
http://localhost:8080
```

前端 dev server 會把 `/api` proxy 到 `http://localhost:8080`。
