<script setup lang="ts">
const router = useRouter();
const route = useRoute();

onMounted(() => {
  const targetRoute = (route.params as { route?: string })?.route;
  router.replace({ path: '/scanned', query: targetRoute ? { route: targetRoute } : undefined });
});
</script>

<template>
  <div class="p-4 text-body-1">正在跳转到阳光跑页面…</div>
</template>
