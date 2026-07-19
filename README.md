# Form Attachment Practice

React + Vite 前端、Spring Boot 3 後端、SQLite 暫存資料，以及 `Attachments/{attId}` 實體附件儲存。

## Docker

```bash
docker build -t form-attachment-practice .
docker run --rm -p 8080:8080 -v "${PWD}/Attachments:/app/Attachments" -v "${PWD}/data:/app/data" form-attachment-practice
```

開啟 `http://localhost:8080`。

## Local development

前端：

```bash
cd src/frontend
npm install
npm run dev
```

後端：

```bash
cd src/backend
mvn spring-boot:run
```

前端 dev server 會把 `/api` proxy 到 `http://localhost:8080`。
