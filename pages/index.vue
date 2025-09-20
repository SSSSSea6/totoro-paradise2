<script setup lang="ts">
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';

const router = useRouter();
const { data } = await useFetch<{ uuid: string; imgUrl: string }>('/api/scanQr');
const message = ref('');
const session = useSession();

const handleScanned = async () => {
  const scanRes = await $fetch(`/api/scanQr/${data!.value!.uuid}`);
  const code = (scanRes as { code: string; message: null } | { code: null; message: string })
    .code as string;
  try {
    const loginResult = (
      await Promise.all([TotoroApiWrapper.getLesseeServer(code), TotoroApiWrapper.getAppAd(code)])
    )[0];
    if (!loginResult.token) {
      message.value = loginResult.message as string;
      return;
    }
    // 获取额外信息
    const personalInfo = await TotoroApiWrapper.login({ token: loginResult.token });
    session.value = { ...personalInfo, token: loginResult.token, code, data: null };
    const breq = {
      token: loginResult.token,
      campusId: personalInfo.campusId,
      schoolId: personalInfo.schoolId,
      stuNumber: personalInfo.stuNumber,
    };
    await TotoroApiWrapper.getAppFrontPage(breq);
    await TotoroApiWrapper.getAppSlogan(breq);
    await TotoroApiWrapper.updateAppVersion(breq);
    await TotoroApiWrapper.getAppNotice(breq);
    router.push('/scanned');
  } catch (e) {
    console.error(e);
    message.value = '龙猫服务器错误';
  }
};
</script>
<template>
  <p class="mt-6 text-center text-2xl font-bold text-white bg-primary px-4 py-2 rounded-lg inline-block">
  “信息本该自由，学习本应简单。”
</p >
  <p class="mt-2 text-center">“本项目fork自BeiyanYunyi的项目，我稍作了一些修改,原项目在右上角。”</p>
  <VDivider class="my-4" />
  <div class="flex flex-col items-center gap-4">
    <p class="text-body-1 text-center">用微信扫码登录后点击“下一步”，稍等约10秒。</p>
    <VCard :height="200" :width="200">
      <img v-if="!message" :src="data!.imgUrl" class="w-100" referrerpolicy="no-referrer" />
      <div v-else class="h-100 w-100 flex items-center justify-center">
        {{ message }}
      </div>
    </VCard>
    <div class="mt-2 flex justify-center">
      <VBtn color="primary" append-icon="i-mdi-arrow-right" @click="handleScanned"> 下一步 </VBtn>
    </div>
    <div class="absolute bottom-12 left-0 right-0 text-center text-gray-700 font-bold text-xl pre-wrap">
  {{ poem[Math.floor(Math.random() * poem.length)].join('\n') }}
</div>
  </div>
</template>
