<script setup lang="ts">
import type { HTTPError } from 'ky';
import type BasicRequest from '~/src/types/requestTypes/BasicRequest';
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';

const router = useRouter();
const { data } = await useFetch<{ uuid: string; imgUrl: string }>('/api/scanQr');
const message = ref('');
const isLoading = ref(false);
const session = useSession();

const isKyHttpError = (error: unknown): error is HTTPError =>
  !!error &&
  typeof error === 'object' &&
  'response' in error &&
  typeof (error as Record<string, any>).response?.status === 'number';

const runPostLoginPrefetch = (req: BasicRequest) => {
  const optionalCalls: Array<{ label: string; run: () => Promise<unknown> }> = [
    { label: 'getAppFrontPage', run: () => TotoroApiWrapper.getAppFrontPage(req) },
    { label: 'getAppSlogan', run: () => TotoroApiWrapper.getAppSlogan(req) },
    { label: 'updateAppVersion', run: () => TotoroApiWrapper.updateAppVersion(req) },
    { label: 'getAppNotice', run: () => TotoroApiWrapper.getAppNotice(req) },
  ];

  Promise.allSettled(optionalCalls.map(({ run }) => run()))
    .then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(
            `[totoro-prefetch] ${optionalCalls[index]!.label} failed`,
            result.reason,
          );
        }
      });
    })
    .catch((error) => console.error('[totoro-prefetch] unexpected failure', error));
};

const fireAndForgetAppAd = (code: string) => {
  TotoroApiWrapper.getAppAd(code).catch((error) =>
    console.warn('[totoro-login] getAppAd failed', error),
  );
};

const handleScanned = async () => {
  if (isLoading.value) return;
  message.value = '';

  const uuid = data.value?.uuid;
  if (!uuid) {
    message.value = '二维码无效，请刷新后重试';
    return;
  }

  isLoading.value = true;
  try {
    const scanRes = await $fetch<{ code: string | null; message: string | null }>(
      `/api/scanQr/${uuid}`,
    );
    if (!scanRes.code) {
      message.value = scanRes.message ?? '扫码失败，请稍后再试';
      return;
    }

    const lesseeServer = await TotoroApiWrapper.getLesseeServer(scanRes.code);
    fireAndForgetAppAd(scanRes.code);

    if (!lesseeServer.token) {
      message.value = (lesseeServer.message as string) ?? '登录失败，请重试';
      return;
    }

    const personalInfo = await TotoroApiWrapper.login({ token: lesseeServer.token });
    session.value = { ...personalInfo, token: lesseeServer.token, code: scanRes.code, data: null };

    const breq: BasicRequest = {
      token: lesseeServer.token,
      campusId: personalInfo.campusId,
      schoolId: personalInfo.schoolId,
      stuNumber: personalInfo.stuNumber,
    };

    runPostLoginPrefetch(breq);
    await router.push('/scanned');
  } catch (error) {
    console.error('[totoro-login] handleScanned failed', error);
    if (isKyHttpError(error)) {
      if (error.response.status === 504) {
        message.value = '龙猫服务器响应超时，请稍后重试';
      } else if (error.response.status === 502) {
        message.value = '龙猫服务器连接失败，请稍后再试';
      } else {
        message.value = '龙猫服务器错误';
      }
    } else {
      message.value = '龙猫服务器错误';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>
<template>
  <p class="mt-4 text-center text-2xl font-bold text-primary">
  “信息本该自由，学习本应简单。”
</p >
  <p class="mt-2 text-center" style="color: red;">每天22:30以后跑步会失败，注意时间。</p>
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
      <VBtn
        color="primary"
        append-icon="i-mdi-arrow-right"
        :loading="isLoading"
        :disabled="isLoading"
        @click="handleScanned"
      >
        下一步
      </VBtn>
          </div>
      <!-- 诗句：按钮下方固定 16px -->
      <div class="relative mt-4 text-center text-gray-700 font-bold text-xl pre-wrap">
        {{ poem[Math.floor(Math.random() * poem.length)].join('\n') }}
      </div>
    </div>
</template>
