<script setup lang="ts">
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';
import type MornSignPoint from '~/src/types/MornSignPoint';
import type MorningTaskRequest from '~/src/types/requestTypes/MorningTaskRequest';
import normalizeSession from '~/src/utils/normalizeSession';

type CreditsResponse = { success?: boolean; credits?: number; message?: string };
type ReserveResponse = { success?: boolean; message?: string; scheduledTime?: string };
type RecordItem = {
  id: number;
  scheduled_time: string;
  status: string;
  result_log?: string | null;
  created_at?: string;
};

const router = useRouter();
const session = useSession();
const hydratedSession = computed(() => normalizeSession(session.value || {}));

const credits = ref(0);
const loadingCredits = ref(false);
const loadingReserve = ref(false);
const fetchingPoints = ref(false);
const loadingRecords = ref(false);
const signPoints = ref<MornSignPoint[]>([]);
const records = ref<RecordItem[]>([]);
const selectedPointId = ref('');
const reservationDate = ref<string>(getDefaultDate());
const reservationTime = ref<string>(getDefaultTime());
const snackbar = ref(false);
const snackbarMessage = ref('');
const redeemDialog = ref(false);
const redeemCode = ref('');
const redeemLinksDialog = ref(false);
const windowMeta = ref<{ startTime?: string; endTime?: string; offsetRange?: string } | null>(null);
const lastScheduledTime = ref('');
const refreshTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const isLoggedIn = computed(() => Boolean(hydratedSession.value?.token));

const notify = (msg: string) => {
  snackbarMessage.value = msg;
  snackbar.value = true;
};

function getDefaultDate() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function getDefaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  return now.toISOString().slice(11, 16); // HH:mm
}

const computeScheduledTime = () => {
  const datePart = reservationDate.value || getDefaultDate();
  const timePart = reservationTime.value || getDefaultTime();
  const candidate = new Date(`${datePart}T${timePart}:00`);
  return candidate.toISOString();
};

const ensureLogin = () => {
  if (!isLoggedIn.value) {
    notify('请先扫码登录');
    return false;
  }
  return true;
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

const displayName = computed(() => {
  if (!hydratedSession.value) return '未登录';
  return hydratedSession.value.stuName || (hydratedSession.value as any).name || '已登录';
});

const displaySchool = computed(
  () =>
    hydratedSession.value?.campusName ||
    hydratedSession.value?.schoolName ||
    (session.value as any)?.campusName ||
    (session.value as any)?.schoolName ||
    '未获取',
);
const displayCollege = computed(
  () =>
    hydratedSession.value?.collegeName ||
    hydratedSession.value?.naturalName ||
    (session.value as any)?.collegeName ||
    (session.value as any)?.naturalName ||
    '未获取',
);
const displayStuNumber = computed(
  () =>
    hydratedSession.value?.stuNumber ||
    (session.value as any)?.stuNumber ||
    (session.value as any)?.studentId ||
    '未获取',
);
const displayStuName = computed(
  () => hydratedSession.value?.stuName || (session.value as any)?.stuName || displayName.value,
);

const hydrateSession = async () => {
  if (!hydratedSession.value?.token) return;
  const missing =
    !hydratedSession.value?.schoolName ||
    !hydratedSession.value?.campusName ||
    !hydratedSession.value?.stuNumber ||
    !hydratedSession.value?.stuName;
  if (!missing) return;
  try {
    const refreshed = await TotoroApiWrapper.login({ token: hydratedSession.value.token });
    session.value = normalizeSession({ ...session.value, ...refreshed });
  } catch (error) {
    console.warn('[mornsign] hydrateSession failed', error);
  }
};

const fetchCredits = async () => {
  if (!ensureLogin()) return;
  loadingCredits.value = true;
  try {
    const res = await $fetch<CreditsResponse>('/api/user/credits', {
      method: 'POST',
      body: { action: 'get', userId: hydratedSession.value.stuNumber },
    });
    if (typeof res.credits === 'number') credits.value = res.credits;
    if (res.message && res.success === false) notify(res.message);
  } catch (error) {
    console.error('[mornsign] fetchCredits failed', error);
    notify('获取余额失败，请稍后重试');
  } finally {
    loadingCredits.value = false;
  }
};

const loadMornSignPaper = async () => {
  if (!ensureLogin()) return;
  if (
    !hydratedSession.value?.token ||
    !hydratedSession.value?.campusId ||
    !hydratedSession.value?.schoolId ||
    !hydratedSession.value?.stuNumber
  ) {
    await hydrateSession();
  }
  if (
    !hydratedSession.value?.token ||
    !hydratedSession.value?.campusId ||
    !hydratedSession.value?.schoolId ||
    !hydratedSession.value?.stuNumber
  ) {
    notify('账号信息不完整，请重新扫码登录');
    return;
  }

  fetchingPoints.value = true;
  try {
    const breq: MorningTaskRequest = {
      token: hydratedSession.value.token,
      campusId: hydratedSession.value.campusId,
      schoolId: hydratedSession.value.schoolId,
      stuNumber: hydratedSession.value.stuNumber,
      phoneNumber:
        hydratedSession.value.phoneNumber ||
        (session.value as any)?.phoneNumber ||
        (hydratedSession.value as any)?.phone ||
        '',
    };
    const paper = await TotoroApiWrapper.getMornSignPaper(breq);
    signPoints.value = (paper.signPointList || []).map((p) => ({
      ...p,
      signType: paper.signType,
    }));
    if (!selectedPointId.value && signPoints.value.length) {
      selectedPointId.value = signPoints.value[0]!.pointId;
    }
    windowMeta.value = {
      startTime: paper.startTime,
      endTime: paper.endTime,
      offsetRange: paper.offsetRange,
    };
  } catch (error) {
    console.error('[mornsign] loadMornSignPaper failed', error);
    notify('获取签到点失败，请稍后重试');
  } finally {
    fetchingPoints.value = false;
  }
};

const handleRedeem = async () => {
  if (!ensureLogin()) return;
  if (!redeemCode.value.trim()) {
    notify('请输入兑换码');
    return;
  }
  try {
    const res = await $fetch<CreditsResponse>('/api/user/credits', {
      method: 'POST',
      body: {
        action: 'redeem',
        userId: hydratedSession.value.stuNumber,
        code: redeemCode.value.trim(),
      },
    });
    notify(res.message ?? '兑换完成');
    if (res.success) {
      credits.value = res.credits ?? credits.value;
      redeemDialog.value = false;
      redeemCode.value = '';
    }
  } catch (error) {
    console.error('[mornsign] redeem failed', error);
    notify('兑换失败，请稍后重试');
  }
};

const handleReserve = async () => {
  if (!ensureLogin()) return;
  if (credits.value <= 0) {
    notify('余额不足，请先充值');
    return;
  }
  if (!signPoints.value.length) {
    await loadMornSignPaper();
  }
  const target =
    signPoints.value.find((p) => p.pointId === selectedPointId.value) || signPoints.value[0];
  if (!target) {
    notify('未找到可用的签到点');
    return;
  }

  const jitteredPoint = target; // 不再抖动位置
  loadingReserve.value = true;
  try {
    const scheduledTime = computeScheduledTime();
    const res = await $fetch<ReserveResponse>('/api/mornsign/reserve', {
      method: 'POST',
      body: {
        token: hydratedSession.value.token,
        userId: hydratedSession.value.stuNumber,
        signPoint: jitteredPoint,
        scheduledTime,
        deviceInfo: {
          campusId: hydratedSession.value.campusId,
          schoolId: hydratedSession.value.schoolId,
          phoneNumber: hydratedSession.value.phoneNumber,
          signType: (signPoints.value.find((p) => p.pointId === target.pointId) as any)?.signType,
        },
      },
    });
    notify(res.message ?? '预约完成');
    if (res.success) {
      credits.value = Math.max(0, credits.value - 1);
      lastScheduledTime.value = res.scheduledTime || scheduledTime;
      await loadRecords();
    }
  } catch (error) {
    console.error('[mornsign] reserve failed', error);
    notify('预约失败，请稍后重试');
  } finally {
    loadingReserve.value = false;
  }
};

const loadRecords = async () => {
  if (!ensureLogin()) return;
  loadingRecords.value = true;
  try {
    const res = await $fetch<{ records: RecordItem[] }>('/api/mornsign/records', {
      method: 'GET',
      query: { userId: hydratedSession.value.stuNumber },
    });
    records.value = res.records || [];
  } catch (error) {
    console.error('[mornsign] loadRecords failed', error);
  } finally {
    loadingRecords.value = false;
  }
};

const formatDateTime = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleString() : '';

const randomRefreshDelayMs = () => 10 * 60 * 500 + Math.random() * 20 * 60 * 1000;

const clearRefreshTimer = () => {
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value);
    refreshTimer.value = null;
  }
};

const refreshTokenOnce = async () => {
  if (!hydratedSession.value?.token) return;
  try {
    const refreshed = await TotoroApiWrapper.login({ token: hydratedSession.value.token });
    const nextToken = refreshed?.token || hydratedSession.value.token;
    const nextSession = normalizeSession({ ...session.value, ...refreshed, token: nextToken });
    session.value = nextSession as any;
    const userId = refreshed?.stuNumber || hydratedSession.value.stuNumber;
    if (userId && nextToken) {
      await syncPendingMorningTasks(userId, nextToken);
    }
  } catch (error) {
    console.warn('[mornsign] auto refresh token failed', error);
  }
};

const scheduleTokenRefresh = () => {
  clearRefreshTimer();
  if (!hydratedSession.value?.token) return;
  const delay = randomRefreshDelayMs();
  refreshTimer.value = setTimeout(async () => {
    await refreshTokenOnce();
    scheduleTokenRefresh();
  }, delay);
};

onMounted(() => {
  if (!isLoggedIn.value) {
    router.push('/login?redirect=/mornsign');
    return;
  }
  session.value = normalizeSession(localStorage.getItem('totoroSession') || session.value || {});
  hydrateSession();
  fetchCredits();
  loadMornSignPaper();
  loadRecords();
  scheduleTokenRefresh();
});

onUnmounted(() => {
  clearRefreshTimer();
});

watch(
  () => hydratedSession.value?.token,
  (val) => {
    if (!val) {
      clearRefreshTimer();
      router.push('/login?redirect=/mornsign');
      return;
    }
    scheduleTokenRefresh();
    hydrateSession();
    fetchCredits();
    loadMornSignPaper();
    loadRecords();
  },
);
</script>

<template>
  <div class="p-4 space-y-4">
    <VAlert v-if="!isLoggedIn" type="warning" variant="tonal" class="mb-2">
      请先扫码登录
      <VBtn variant="text" color="primary" class="ml-2" to="/login?redirect=/mornsign">
        前往登录
      </VBtn>
    </VAlert>

    <VCard v-if="isLoggedIn" class="p-4 space-y-3">
      <div class="space-y-1">
        <div class="text-h6">当前账号：{{ displayName }}</div>
        <div class="text-body-2 text-gray-700">
          学校：{{ displaySchool }}
        </div>
        <div class="text-body-2 text-gray-700">
          学院：{{ displayCollege }}
        </div>
        <div class="text-body-2 text-gray-700">学号：{{ displayStuNumber }}</div>
        <div class="text-body-2 text-gray-700">姓名：{{ displayStuName }}</div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span>次数余额：</span>
        <span class="text-2xl font-bold text-green-600">{{ credits }}</span>
        <VBtn size="small" color="primary" @click="redeemDialog = true">添加次数</VBtn>
        <VBtn size="small" variant="text" :loading="loadingCredits" @click="fetchCredits">
          刷新
        </VBtn>
      </div>
    </VCard>

    <VCard v-if="isLoggedIn" class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-h6">预约早操签到</div>
          <div class="text-caption text-gray-500">
            请选择预约日期和时间（可自选任意时间，用于测试）。
          </div>
        </div>
        <VBtn variant="text" :loading="fetchingPoints" @click="loadMornSignPaper">
          重新获取点位
        </VBtn>
      </div>
      <VRow dense>
        <VCol cols="12" md="6">
          <VSelect
            v-model="selectedPointId"
            :items="signPoints"
            item-title="pointName"
            item-value="pointId"
            label="签到点位"
            :loading="fetchingPoints"
            variant="outlined"
          />
        </VCol>
        <VCol cols="12" md="3">
          <VTextField
            v-model="reservationDate"
            type="date"
            label="预约日期"
            variant="outlined"
          />
        </VCol>
        <VCol cols="12" md="3">
          <VTextField
            v-model="reservationTime"
            type="time"
            label="预约时间"
            variant="outlined"
          />
        </VCol>
      </VRow>
      <VBtn
        block
        color="orange"
        size="large"
        :disabled="credits <= 0 || loadingReserve"
        :loading="loadingReserve"
        @click="handleReserve"
      >
        立即预约（消耗 1 次）
      </VBtn>
    </VCard>

    <VCard v-if="isLoggedIn" class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="text-h6">预约记录</div>
        <VBtn variant="text" :loading="loadingRecords" @click="loadRecords">刷新记录</VBtn>
      </div>
      <VTable density="compact">
        <thead>
          <tr>
            <th>时间</th>
            <th>状态</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!records.length">
            <td colspan="3" class="text-center text-gray-500">暂无记录</td>
          </tr>
          <tr v-for="rec in records" :key="rec.id">
            <td>{{ formatDateTime(rec.scheduled_time) }}</td>
            <td>{{ rec.status }}</td>
            <td class="max-w-80 whitespace-pre-wrap text-sm text-gray-600">
              {{ rec.result_log || '无' }}
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <VDialog v-model="redeemDialog" max-width="420">
      <VCard title="充值次数">
        <VCardText>
          <VTextField
            v-model="redeemCode"
            label="请输入兑换码"
            variant="outlined"
            clearable
          />
          <div class="mt-2 text-center text-caption">
            <a
              href="#"
              rel="noopener"
              class="text-blue-500"
              @click.prevent="redeemLinksDialog = true"
            >
              获取兑换码
            </a>
          </div>
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn variant="text" @click="redeemDialog = false">取消</VBtn>
          <VBtn color="primary" @click="handleRedeem">兑换</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="redeemLinksDialog" max-width="420">
      <VCard title="获取兑换码">
        <VCardText class="space-y-2">
          <div>选择需要的次数：</div>
          <div class="flex flex-col gap-2">
            <VBtn
              variant="tonal"
              color="primary"
              href="https://mbd.pub/o/bread/YZWZmJhxbA=="
              target="_blank"
              rel="noopener"
              block
            >
              获取 1 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://mbd.pub/o/bread/YZWZmJhxbQ=="
              target="_blank"
              rel="noopener"
              block
            >
              获取 2 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://mbd.pub/o/bread/YZWZmJhyZA=="
              target="_blank"
              rel="noopener"
              block
            >
              获取 5 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://mbd.pub/o/bread/YZWZmJhyZQ=="
              target="_blank"
              rel="noopener"
              block
            >
              获取 10 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://mbd.pub/o/bread/YZWZmJhyZg=="
              target="_blank"
              rel="noopener"
              block
            >
              获取 30 次
            </VBtn>
          </div>
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn variant="text" @click="redeemLinksDialog = false">关闭</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :timeout="3000">
      {{ snackbarMessage }}
    </VSnackbar>
  </div>
</template>
