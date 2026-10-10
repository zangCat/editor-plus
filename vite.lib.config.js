/**
 * npm 库构建配置（与演示应用 vite.config.js 分离）
 *
 * 产物（dist/）：
 *   index.js               核心入口（框架无关：NextEditor + pipeline + 渲染器注册表 + 图表注册）
 *   vue.js                 可选 Vue 适配子入口（EditorPlus 薄组件）
 *   index.css              核心样式（prosemirror 基础样式 + editor-plus.css，构建后脚本拼接）
 *   *.d.ts                 vite-plugin-dts 从 JSDoc 源生成
 *
 * 仅 ESM：unified/remark 生态为 ESM-only，CJS interop 包装器与 Node require(esm)
 * 冲突（default 解包错位），故不产出 CJS；Node 22+ 可直接 require() 加载 ESM
 * （exports 中的 default 条件兜底）。
 *
 * 依赖策略：所有「裸导入」一律 external，由宿主解析安装。
 * 注意不能只 external 顶层包名：codemirror/@codemirror/* 的传递依赖（如
 * @codemirror/state、@lezer/*、style-mod）会被内联进产物，宿主侧出现双实例后
 * CodeMirror 6 的 instanceof 检查失效（源码模式报 Unrecognized extension value
 * 并渲染空白），因此必须零内联。
 */
import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      entryRoot: "src",
      include: ["src/**/*.ts"],
      outDir: "dist",
      // 仅生成 .d.ts，不做类型检查（typecheck 由独立脚本负责）
      strictOutput: true,
    }),
  ],
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: {
        index: "src/index.ts",
        vue: "src/vue.ts",
      },
      formats: ["es"],
      // CSS 产物命名 dist/index.css（默认取包名 editor-plus.css，与 exports 对齐）
      cssFileName: "index",
    },
    rollupOptions: {
      // 相对路径与 CSS（prosemirror/katex 的样式）不外部化，交给 Vite 打包/汇聚为 dist/index.css
      external: (id) =>
        !id.endsWith(".css") &&
        !id.startsWith(".") &&
        !id.startsWith("\0") &&
        !path.isAbsolute(id),
    },
  },
});
