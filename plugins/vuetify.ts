// plugins/vuetify.ts
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import colors from 'vuetify/lib/util/colors';

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    theme: {
      themes: {
        light: {
          dark: false,
          colors: {
            primary: '#ffffff',  // 白色主色
            secondary: '#f0f0f0',  // 浅灰辅助
            background: '#ffffff',  // 全局背景白
          },
        },
      },
    },
    defaults: {
      VBtn: { variant: 'text', elevation: 0 },  // 无阴影，简约
      VCard: { elevation: 0, rounded: 'md' },  // 圆角流畅，无阴影
    },
    icons: { defaultSet: 'mdi' },
  });
  nuxtApp.vueApp.use(vuetify);
});
