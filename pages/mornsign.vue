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
const snackbar = ref(false);
const snackbarMessage = ref('');
const redeemDialog = ref(false);
const redeemCode = ref('');
const redeemLinksDialog = ref(false);
const windowMeta = ref<{ startTime?: string; endTime?: string; offsetRange?: string } | null>(
  null,
);
const lastScheduledTime = ref('');
const displayStart = '06:35';
const displayEnd = '08:25';

const isLoggedIn = computed(() => Boolean(hydratedSession.value?.token));

const notify = (msg: string) => {
  snackbarMessage.value = msg;
  snackbar.value = true;
};

const ensureLogin = () => {
  if (!isLoggedIn.value) {
    notify('请先扫码登录');
    return false;
  }
  return true;
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

const jitterPoint = (point: MornSignPoint, meters = 10): MornSignPoint => {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return point;
  // 简单抖动：在指定米数内随机偏移
  const degLat = meters / 111000; // 1度纬度约111km
  const degLng = meters / (111000 * Math.cos((lat * Math.PI) / 180) || 1);
  const rnd = () => (Math.random() - 0.5) * 2; // -1~1
  return {
    ...point,
    latitude: (lat + rnd() * degLat).toString(),
    longitude: (lng + rnd() * degLng).toString(),
  };
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
    const res = await $fetch<ReserveResponse>('/api/mornsign/reserve', {
      method: 'POST',
      body: {
        token: hydratedSession.value.token,
        userId: hydratedSession.value.stuNumber,
        signPoint: jitteredPoint,
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
      lastScheduledTime.value = res.scheduledTime || '';
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

onMounted(() => {
  if (!isLoggedIn.value) {
    router.push('/login?redirect=/mornsign');
    return;
  }
  // 进入页时刷新一次信息，确保显示当前账号
  session.value = normalizeSession(localStorage.getItem('totoroSession') || session.value || {});
  hydrateSession();
  fetchCredits();
  loadMornSignPaper();
  loadRecords();
});

watch(
  () => hydratedSession.value?.token,
  (val) => {
    if (!val) {
      router.push('/login?redirect=/mornsign');
      return;
    }
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
          <div class="text-h6">???????</div>
          <div class="text-caption text-gray-500">
            ?????? 06:35-08:25 ??????
          </div>
        </div>
        <VBtn variant="text" :loading="fetchingPoints" @click="loadMornSignPaper">
          ???????
        </VBtn>
      </div>
      <VRow dense>
        <VCol cols="12" md="12">
          <VSelect
            v-model="selectedPointId"
            :items="signPoints"
            item-title="pointName"
            item-value="pointId"
            label="????"
            :loading="fetchingPoints"
            variant="outlined"
          />
          <div class="text-caption text-gray-500 mt-1">???????????</div>
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
              {{ rec.result_log || '—' }}
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
              href="https://afdian.com/item/2bd8c944c9dc11f09f995254001e7c00"
              target="_blank"
              rel="noopener"
              block
            >
              获取 1 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://afdian.com/item/bc3973fcc9dd11f0b56352540025c377"
              target="_blank"
              rel="noopener"
              block
            >
              获取 2 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://afdian.com/item/1953981ac9de11f0b69652540025c377"
              target="_blank"
              rel="noopener"
              block
            >
              获取 5 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://afdian.com/item/be460538c9de11f0adee52540025c377"
              target="_blank"
              rel="noopener"
              block
            >
              获取 10 次
            </VBtn>
            <VBtn
              variant="tonal"
              color="primary"
              href="https://afdian.com/item/2f87de74c9df11f09c7c5254001e7c00"
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