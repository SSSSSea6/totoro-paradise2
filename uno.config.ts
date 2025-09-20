// uno.config.ts
import { defineConfig, presetIcons, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss';

export default defineConfig({
  presets: [presetWind(), presetIcons()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  rules: [
    ['pre-wrap', { 'white-space': 'pre-wrap' }],
    ['bg-white-main', { 'background-color': '#ffffff' }],  // 白色背景
    ['border-smooth', { 'border': '1px solid #f0f0f0', 'border-radius': '8px' }],  // 简约线条
  ],
  theme: {
    colors: { primary: '#ffffff' },
    transition: { duration: '300ms', timing: 'ease-in-out' },  // 丝滑切换
  },
});
