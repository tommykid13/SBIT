# SBTI 人格测试网站

一个纯前端实现的 SBTI 人格测试网站。题库、人格模式和结果匹配全部在浏览器本地计算，不依赖 Python 后端。

## 本地运行

```bash
npm run test
npm run dev
```

`npm run dev` 会通过 Cloudflare Wrangler 在本地预览 `public/` 下的静态站。

## 项目结构

- `public/`：线上实际部署内容
- `public/image/`：人格结果图片
- `public/data.js`：题库、维度、人格数据
- `public/logic.js`：计分、等级映射、人格匹配逻辑
- `public/app.js`：页面交互与渲染
- `scripts/verify.mjs`：逻辑校验脚本

## 上传到 GitHub

```bash
git init
git add .
git commit -m "feat: build sbti personality test site"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

如果本机没有 `gh`，先在 GitHub 网页端创建空仓库，再把远程地址填进上面的命令。

## 部署到 Cloudflare Pages

Cloudflare 官方支持用 Wrangler 直接上传静态站，也支持连接 GitHub 仓库自动部署。

### 方式一：直接上传

```bash
npx wrangler login
npx wrangler pages project create sbti-personality-test
npm run deploy
```

### 方式二：连接 GitHub 仓库

1. 在 Cloudflare Pages 控制台里选择连接 GitHub 仓库
2. 选择当前仓库
3. `Build command` 留空
4. `Build output directory` 填 `public`

## 参考来源

- 原始灵感：B 站 @蛆肉儿串儿 的 SBTI 测试
- 公开参考实现：[sing1ee/sbti-skill](https://github.com/sing1ee/sbti-skill)

仅供娱乐。
