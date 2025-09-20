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
  <div class="bg-white-main min-h-screen flex flex-col items-center justify-center relative p-4">
    <!-- 左上 logo -->
    < img src="~/assets/logo.png" class="absolute top-4 left-4 h-12 w-auto" alt="My Logo" />

    <!-- 右上 GitHub 图标 -->
    <div class="absolute top-4 right-4 flex space-x-4">
      <a href=" " target="_blank">
        <VIcon icon="mdi-github" size="large" class="text-gray-800 hover:text-black transition-colors duration-300" />
      </a >
      <a href="https://github.com/原作者/龙猫校园跑" target="_blank">
        <VIcon icon="mdi-github" size="large" class="text-gray-800 hover:text-black transition-colors duration-300" />
      </a >
    </div>

    <!-- 提醒语句 -->
    <p class="text-body-1 text-gray-600 mb-4">本项目fork自BeiyanYunyi，我在原项目上稍作修改，增加了“跳过等待‘选项。</p >

    <!-- 简洁内容 -->
    <p class="text-body-1 mb-4">请用微信扫码登录后点击“下一步”，等待几秒。</p >
    <VCard :height="200" :width="200" class="border-smooth">
      < img v-if="!message" :src="data!.imgUrl" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
      <div v-else class="h-full w-full flex items-center justify-center text-gray-800">
        {{ message }}
      </div>
    </VCard>
    <div class="mt-4">
      <VBtn color="primary" append-icon="i-mdi-arrow-right" @click="handleScanned"> 下一步 </VBtn>
    </div>
  </div>
</template>
