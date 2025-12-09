<script setup lang="ts">
import type { HTTPError } from 'ky';
import type BasicRequest from '~/src/types/requestTypes/BasicRequest';
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';
import normalizeSession from '~/src/utils/normalizeSession';
import poem from '~/src/data/poem.json';

const { data, refresh, pending } = await useFetch<{ uuid: string; imgUrl: string }>(
  '/api/scanQr',
);
const message = ref('');
const snackbar = ref(false);
const welcomeSnackbar = ref(true);
const isLoading = ref(false);
const session = useSession();
const mornSignNotice = '早操签到功能仍不完善，所有已购买的已退款';
const MORNSIGN_PASSWORD = '982108244Qq';
const MORNSIGN_MAX_ATTEMPTS = 4;
const mornSignFailedAttempts = ref(0);

const hydratedSession = computed(() => normalizeSession(session.value || {}));
const isLoggedIn = computed(
  () =>
    Boolean(hydratedSession.value?.token) &&
    Boolean(hydratedSession.value?.stuNumber) &&
    Boolean(hydratedSession.value?.stuName),
);
const polling = ref(false);
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);
const router = useRouter();
const poemLines = useState('home-poem', () => poem[Math.floor(Math.random() * poem.length)]);

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

  Promise.allSettled(optionalCalls.map(({ run }) => run())).catch((error) =>
    console.error('[totoro-prefetch] unexpected failure', error),
  );
};

const fireAndForgetAppAd = (code: string) => {
  TotoroApiWrapper.getAppAd(code).catch((error) =>
    console.warn('[totoro-login] getAppAd failed', error),
  );
};

const syncPendingMorningTasks = async (userId: string, token: string) => {
  try {
    await $fetch('/api/mornsign/sync-token', {
      method: 'POST',
      body: { userId, token },
    });
  } catch (error) {
    console.warn('[mornsign] sync token failed', error);
  }
};

const handleScanned = async () => {
  if (isLoading.value || isLoggedIn.value) return;
  message.value = '';
  snackbar.value = false;

  const uuid = data.value?.uuid;
  if (!uuid) {
    message.value = '二维码无效，请刷新后重试';
    snackbar.value = true;
    await refresh();
    return;
  }

  isLoading.value = true;
  try {
    const scanRes = await $fetch<{ code: string | null; message: string | null }>(
      `/api/scanQr/${uuid}`,
    );
    if (!scanRes.code) {
      message.value = scanRes.message ?? '扫码失败，请稍后再试';
      snackbar.value = true;
      return;
    }

    const lesseeServer = await TotoroApiWrapper.getLesseeServer(scanRes.code);
    fireAndForgetAppAd(scanRes.code);

    if (!lesseeServer.token) {
      message.value = (lesseeServer.message as string) ?? '登录失败，请重试';
      snackbar.value = true;
      return;
    }

    const personalInfo = await TotoroApiWrapper.login({ token: lesseeServer.token });
    const normalized = normalizeSession({
      ...personalInfo,
      token: lesseeServer.token,
      code: scanRes.code,
    });
    session.value = normalized as any;
    await syncPendingMorningTasks(personalInfo.stuNumber, lesseeServer.token);

    const breq: BasicRequest = {
      token: lesseeServer.token,
      campusId: personalInfo.campusId,
      schoolId: personalInfo.schoolId,
      stuNumber: personalInfo.stuNumber,
    };
    runPostLoginPrefetch(breq);

    message.value = '登录成功，可选择入口';
    snackbar.value = true;
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
    snackbar.value = true;
  } finally {
    isLoading.value = false;
  }
};

const startPolling = () => {
  if (pollTimer.value) return;
  polling.value = true;
  pollTimer.value = setInterval(() => {
    if (isLoggedIn.value || isLoading.value) return;
    handleScanned();
  }, 3000);
};

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
  polling.value = false;
};

onMounted(() => {
  session.value = {};
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

watch(
  () => isLoggedIn.value,
  (loggedIn) => {
    if (loggedIn) stopPolling();
    else startPolling();
  },
);

const goSunRun = () => {
  if (!isLoggedIn.value) {
    snackbar.value = true;
    message.value = '请先扫码登录';
    return;
  }
  router.push('/scanned');
};

const goFreeRun = () => {
  if (!isLoggedIn.value) {
    snackbar.value = true;
    message.value = '请先扫码登录';
    return;
  }
  router.push('/freerun');
};

const goMornSign = () => {
  message.value = mornSignNotice;
  snackbar.value = true;
  if (typeof window !== 'undefined') {
    window.alert(mornSignNotice);
  }

  if (!isLoggedIn.value) {
    message.value = `${mornSignNotice}。请先扫码登录`;
    snackbar.value = true;
    return;
  }

  if (mornSignFailedAttempts.value >= MORNSIGN_MAX_ATTEMPTS) {
    message.value = '密码错误次数过多，请稍后再试';
    snackbar.value = true;
    return;
  }

  const passwordInput = prompt('请输入早操签到访问密码');
  if (passwordInput === null) return;

  if (passwordInput !== MORNSIGN_PASSWORD) {
    mornSignFailedAttempts.value += 1;
    const remaining = MORNSIGN_MAX_ATTEMPTS - mornSignFailedAttempts.value;
    message.value =
      remaining > 0 ? `密码错误，还可再试${remaining}次` : '密码错误次数过多，请稍后再试';
    snackbar.value = true;
    return;
  }

  mornSignFailedAttempts.value = 0;
  router.push('/mornsign');
};
</script>
<template>
  <div class="flex flex-col items-center gap-4 py-10">
    <h1 class="text-2xl font-bold text-primary">信息本该自由，学习本应简单</h1>
    <p class="text-center text-red-500">在每天22:50后提交跑步会失败。</p>
    <VCard :height="220" :width="220" class="flex items-center justify-center">
      <img v-if="data?.imgUrl" :src="data.imgUrl" class="w-100" referrerpolicy="no-referrer" />
      <div v-else class="text-center text-body-2 text-gray-500">正在加载二维码...</div>
    </VCard>
    <div class="flex items-center gap-3">
      <VBtn variant="text" color="secondary" :loading="pending" @click="refresh">
        刷新二维码
      </VBtn>
      <VChip v-if="polling" color="primary" variant="tonal" size="small">自动检测中</VChip>
    </div>
    <VDivider class="w-2/3 my-4" />
    <div class="grid w-full max-w-xl gap-3 sm:grid-cols-2">
      <VBtn
        color="orange"
        block
        height="56"
        :disabled="!isLoggedIn"
        append-icon="i-mdi-run"
        @click="goSunRun"
      >
        阳光跑
      </VBtn>
      <VBtn
        color="green"
        block
        height="56"
        :disabled="!isLoggedIn"
        append-icon="i-mdi-map"
        @click="goFreeRun"
      >
        自由跑
      </VBtn>
    </div>
    <div v-if="!isLoggedIn" class="text-caption text-gray-500">
      未登录时入口按钮会置灰，请先扫码等待自动登录。
    </div>
    <div class="mt-4 text-center text-gray-700 font-bold text-xl whitespace-pre-line">
      {{ poemLines?.join('\n') }}
    </div>
    <VSnackbar v-model="snackbar" :timeout="3000">
      {{ message }}
    </VSnackbar>
    <VSnackbar v-model="welcomeSnackbar" :timeout="4000">
      新增自由跑功能，欢迎使用
    </VSnackbar>
  </div>
</template>
