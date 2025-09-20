<script setup lang="ts">
// import '@unocss/reset/tailwind.css';

const appConfig = useAppConfig();

useHead({
  title: '龙猫乐园'
})
</script>
<script lang="ts">
window.global = window;
</script>
<template>
  <VApp>
    <VAppBar color="primary">
  < img src="/logo.png" alt="logo" class="h-10 w-10 mr-2 ml-2" />
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
      <div class="p-4">
        <NuxtPage />
        <!--p class="mt-4 text-xs">
          Powered by totoro-paradise v{{ appConfig.version }}
        </p> -->
      </div>
    </VMain>
  </VApp>
</template>
