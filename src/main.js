import { createApp } from "vue";
import App from "./App.vue";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";
import "katex/dist/katex.min.css";
import "./styles/editor-plus.css";
import "./styles/demo.css";
// side-effect：注册全部图表渲染器（演示页需要；核心入口 src/index.ts 已内置同款注册）
import "./renderers/charts.js";

createApp(App).mount("#app");
