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
      <div
        class="fixed z-30 left-3 top-[76px] sm:left-6 sm:top-[100px]"
        style="pointer-events: none"
      >
        <div
          class="backdrop-blur bg-white/90 rounded-3xl shadow-lg border border-white/60 p-2 flex flex-col sm:flex-row gap-2 sm:items-center"
          style="pointer-events: auto"
        >
          <VBtn
            height="52"
            width="52"
            class="p-0 rounded-2xl overflow-hidden"
            variant="flat"
            :ripple="false"
            href="https://xhslink.com/m/2lvmVCPsKhY"
            target="_blank"
            rel="noopener"
          >
            <VImg :src="xhsIcon" cover height="52" width="52" />
          </VBtn>
          <VBtn
            height="52"
            width="52"
            class="p-0 rounded-2xl overflow-hidden"
            variant="flat"
            :ripple="false"
            href="https://b23.tv/he2YHvs"
            target="_blank"
            rel="noopener"
          >
            <VImg :src="biliIcon" cover height="52" width="52" />
          </VBtn>
          <VBtn
            height="52"
            width="52"
            class="p-0 rounded-2xl overflow-hidden"
            variant="flat"
            color="primary"
            :ripple="false"
            @click="qqDialog = true"
          >
            <VImg :src="qqIcon" cover height="52" width="52" />
          </VBtn>
        </div>
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
