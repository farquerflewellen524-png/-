# MedQuest Pro

规培生全能成长助手，包含习惯养成、规培工作站和科研辅助模块。

默认不需要配置在线服务凭证，可直接在本地运行并使用内置示例/模板结果；如需启用 GPT，请按下方说明显式授权。

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`


## GPT 使用权限（可选）

如需让临床分析、科研辅助、翻译和追问功能调用 GPT，请在本地 `.env.local` 中配置：

```bash
VITE_ENABLE_GPT=true
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_MODEL=gpt-5.2
```

未配置或未开启 `VITE_ENABLE_GPT` 时，应用会自动使用本地模板结果。注意：以 `VITE_` 前缀注入的变量会进入前端构建产物，仅建议用于个人本地运行或受控环境；生产环境建议改为后端代理调用。
