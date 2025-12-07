<script setup lang="ts">
// import '@unocss/reset/tailwind.css';

const appConfig = useAppConfig();

useHead({
  title: '龙猫乐园',
});

const logoUrl = '/nuaa-guide-logo.png';
const qqIcon = new URL('~/icon/icons/qq.webp', import.meta.url).href;
const biliIcon = new URL('~/icon/icons/bilibili.webp', import.meta.url).href;
const xhsIcon = new URL('~/icon/icons/xiaohongshu.webp', import.meta.url).href;
const channelQr = new URL('~/icon/频道.webp', import.meta.url).href;

const qqDialog = ref(false);
</script>
<script lang="ts">
window.global = window;
</script>
<template>
  <VApp>
    <VAppBar color="primary">
      <VAppBarTitle class="min-w-[120px]">
        <a
          href="https://nuaaguide.online/"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center"
        >
          <img :src="logoUrl" alt="NUAA Guide" class="h-10 w-auto" />
        </a>
      </VAppBarTitle>
      <VAppBarTitle class="text-2xl font-bold flex-1 text-center">
        <NuxtLink to="/" class="no-underline text-white bg-green px-2 py-1 rounded-lg inline-block text-2xl gont-blod">
          龙猫乐园
        </NuxtLink>
      </VAppBarTitle>
      <template #append>
        <VAppBarNavIcon
          v-ripple icon="i-mdi-github" href="https://github.com/BeiyanYunyi/totoro-paradise"
          rel="noreferrer noopener" target="_blank"
        />
      </template>
    </VAppBar>
    <VMain>
      <div class="social-stack" style="pointer-events: none">
        <VBtn
          height="44"
          width="44"
          class="p-0 rounded-2xl overflow-hidden social-btn shadow-md"
          variant="flat"
          :ripple="false"
          href="https://xhslink.com/m/2lvmVCPsKhY"
          target="_blank"
          rel="noopener"
          style="pointer-events: auto"
        >
          <VImg :src="xhsIcon" cover class="social-img" />
        </VBtn>
        <VBtn
          height="44"
          width="44"
          class="p-0 rounded-2xl overflow-hidden social-btn shadow-md"
          variant="flat"
          :ripple="false"
          href="https://b23.tv/he2YHvs"
          target="_blank"
          rel="noopener"
          style="pointer-events: auto"
        >
          <VImg :src="biliIcon" cover class="social-img" />
        </VBtn>
        <VBtn
          height="44"
          width="44"
          class="p-0 rounded-2xl overflow-hidden social-btn shadow-md"
          variant="flat"
          :ripple="false"
          @click="qqDialog = true"
          style="pointer-events: auto"
        >
          <VImg :src="qqIcon" cover class="social-img" />
        </VBtn>
      </div>
      <div class="p-4">
        <NuxtPage />
        <!--p class="mt-4 text-xs">
          Powered by totoro-paradise v{{ appConfig.version }}
        </p> -->
      </div>
    </VMain>

    <VDialog v-model="qqDialog" max-width="360">
      <VCard>
        <VCardTitle class="text-center">欢迎加入 NUAA Guide 频道畅所欲言！</VCardTitle>
        <VCardText class="flex justify-center">
          <VImg :src="channelQr" contain max-width="260" />
        </VCardText>
        <VCardActions class="justify-center">
          <VBtn color="primary" @click="qqDialog = false">知道了</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VApp>
</template>

<style scoped>
.social-btn {
  height: 44px !important;
  width: 44px !important;
  min-width: 0 !important;
  padding: 0 !important;
  border-radius: 16px !important;
}
.social-img {
  height: 44px;
  width: 44px;
}
/* 左上角悬浮栈，移动竖排，桌面横排，互相分离 */
.social-stack {
  position: fixed;
  z-index: 30;
  left: 12px;
  top: 76px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (min-width: 640px) {
  .social-btn {
    height: 52px !important;
    width: 52px !important;
    border-radius: 18px !important;
  }
  .social-img {
    height: 52px;
    width: 52px;
  }
  .social-stack {
    flex-direction: row;
    gap: 12px;
    left: 24px;
    top: 96px;
  }
}
</style>
