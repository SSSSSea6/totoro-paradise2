<script setup lang="ts">
import normalizeSession from '~/src/utils/normalizeSession';
import freeRunRoutes from '~/src/data/freeRunRoutes';
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';

type RunResponse = { success?: boolean; message?: string; scantronId?: string; routeDistanceKm?: number };
type CreditsResponse = { success?: boolean; credits?: number; records?: any[]; message?: string };

const router = useRouter();
const session = useSession();
const hydratedSession = computed(() => normalizeSession(session.value || {}));

const km = ref<number>(1.01);
const selectedRouteId = ref<string>(freeRunRoutes[0]?.id || '');
const snackbar = ref(false);
const snackbarMessage = ref('');
const isLoading = ref(false);
const credits = ref<number>(0);
const loadingCredits = ref(false);
const records = ref<Array<{ distance_km?: number; scantron_id?: string; created_at?: string }>>([]);
const redeemDialog = ref(false);
const redeemCode = ref('');
const redeemLinksDialog = ref(false);

const isLoggedIn = computed(() => Boolean(hydratedSession.value?.token));
const displayStuNumber = computed(() => hydratedSession.value?.stuNumber || '-');
const displayStuName = computed(() => hydratedSession.value?.stuName || '-');
const displaySchool = computed(
  () => `${hydratedSession.value?.schoolName || '-'} ${hydratedSession.value?.campusName || ''}`.trim(),
);

const notify = (msg: string) => {
  snackbarMessage.value = msg;
  snackbar.value = true;
};

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
    console.warn('[freerun] hydrateSession failed', error);
  }
};

const ensureLogin = () => {
  if (!isLoggedIn.value) {
    notify('请先扫码登录');
    router.push('/login?redirect=/freerun');
    return false;
  }
  return true;
};

const fetchCredits = async () => {
  if (!ensureLogin()) return;
  loadingCredits.value = true;
  try {
    const res = await $fetch<CreditsResponse>('/api/freerun/credits', {
      method: 'GET',
      query: { userId: hydratedSession.value.stuNumber },
    });
    if (res.success) {
      credits.value = res.credits ?? 0;
      records.value = res.records || [];
    } else if (res.message) {
      notify(res.message);
    }
  } catch (error) {
    console.error('[freerun] fetch credits failed', error);
  } finally {
    loadingCredits.value = false;
  }
};

const handleRedeem = async () => {
  if (!ensureLogin()) return;
  if (!redeemCode.value.trim()) {
    notify('请输入兑换码');
    return;
  }
  try {
    const res = await $fetch<CreditsResponse>('/api/freerun/redeem', {
      method: 'POST',
      body: {
        code: redeemCode.value.trim(),
        userId: hydratedSession.value.stuNumber,
      },
    });
    if (res.success) {
      credits.value = res.credits ?? credits.value;
      notify(res.message ?? '兑换完成');
      redeemDialog.value = false;
      redeemCode.value = '';
      fetchCredits();
    } else if (res.message) {
      notify(res.message);
    }
  } catch (error) {
    console.error('[freerun] redeem failed', error);
    notify('兑换失败，请稍后重试');
  }
};

const handleRun = async () => {
  if (!ensureLogin()) return;
  if (km.value < 0.5 || km.value > 3.2) {
    notify('里程范围仅支持 0.5~3.2km');
    return;
  }
  isLoading.value = true;
  try {
    const res = await $fetch<RunResponse>('/api/freerun/run', {
      method: 'POST',
      body: {
        token: hydratedSession.value.token,
        stuNumber: hydratedSession.value.stuNumber,
        campusId: hydratedSession.value.campusId,
        schoolId: hydratedSession.value.schoolId,
        phoneNumber: hydratedSession.value.phoneNumber,
        km: km.value,
        routeId: selectedRouteId.value,
      },
    });
    notify(res.message ?? '提交完成');
    fetchCredits();
  } catch (error) {
    console.error('[freerun] submit failed', error);
    notify('提交失败，请稍后重试');
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  if (!isLoggedIn.value) {
    router.push('/login?redirect=/freerun');
    return;
  }
  session.value = normalizeSession(localStorage.getItem('totoroSession') || session.value || {});
  hydrateSession();
  fetchCredits();
});

watch(
  () => hydratedSession.value?.token,
  (val) => {
    if (!val) {
      router.push('/login?redirect=/freerun');
      return;
    }
    hydrateSession();
    fetchCredits();
  },
);
</script>

<template>
  <div class="p-4 space-y-4">
    <VAlert v-if="!isLoggedIn" type="warning" variant="tonal" class="mb-2">
      请先扫码登录
      <VBtn variant="text" color="primary" class="ml-2" to="/login?redirect=/freerun">
        前往登录
      </VBtn>
    </VAlert>

    <VCard v-if="isLoggedIn" class="p-4 space-y-4">
      <div class="flex flex-col gap-3">
        <div class="text-h5 font-bold text-left">自由跑</div>

        <div class="flex flex-wrap gap-3">
          <VCard elevation="0" variant="outlined" class="px-4 py-3 w-full sm:w-80">
            <div class="text-sm text-gray-500 mb-1">姓名</div>
            <div class="text-base text-gray-800">{{ displayStuName }}</div>
            <div class="mt-2 text-sm text-gray-500 mb-1">学号</div>
            <div class="text-base text-gray-800">{{ displayStuNumber }}</div>
          </VCard>
        </div>

        <VCard
          elevation="1"
          class="px-4 py-3"
          style="background: linear-gradient(135deg, #fef4e9, #ffe8d1); border: 1px solid #ffd0a6;"
        >
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="text-sm text-gray-600">剩余公里数</div>
              <div class="text-3xl font-bold text-orange-600 leading-tight">
                <span v-if="!loadingCredits">{{ credits.toFixed(2) }}</span>
                <span v-else>加载中...</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <VBtn color="orange" variant="flat" class="rounded-lg px-4" @click="redeemDialog = true">
                兑换/加里程
              </VBtn>
              <VBtn color="primary" variant="tonal" icon="mdi-refresh" @click="fetchCredits" />
            </div>
          </div>
        </VCard>
      </div>

      <VRow dense>
        <VCol cols="12" md="4">
          <VTextField
            v-model.number="km"
            type="number"
            label="目标里程（km）"
            variant="outlined"
            :min="0.5"
            :max="3.2"
            step="0.01"
            hint="范围 0.5 ~ 3.2 km"
            persistent-hint
          />
        </VCol>
        <VCol cols="12" md="6">
          <VSelect
            v-model="selectedRouteId"
            :items="freeRunRoutes.map((r) => ({ title: r.name, value: r.id, subtitle: r.description }))"
            label="选择预设路线"
            variant="outlined"
          />
        </VCol>
      </VRow>

      <VBtn color="orange" block :loading="isLoading" @click="handleRun">
        提交自由跑
      </VBtn>
    </VCard>

    <VDialog v-model="redeemDialog" max-width="480">
      <VCard>
        <VCardTitle>兑换公里</VCardTitle>
        <VCardText>
          <VTextField v-model="redeemCode" label="请输入兑换码" variant="outlined" />
          <div class="text-sm text-primary mt-2 cursor-pointer" @click="redeemLinksDialog = true">
            获取兑换码
          </div>
        </VCardText>
        <VCardActions>
          <VBtn variant="text" @click="redeemDialog = false">取消</VBtn>
          <VBtn color="primary" @click="handleRedeem">兑换</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="redeemLinksDialog" max-width="360">
      <VCard>
        <VCardTitle>选择公里数</VCardTitle>
        <VCardText class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWZl59rZA=="
              target="_blank"
            >
              1 公里
            </VBtn>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWZl5tyaA=="
              target="_blank"
            >
              2 公里
            </VBtn>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWZlp9qbA=="
              target="_blank"
            >
              5 公里
            </VBtn>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWZlpxpaw=="
              target="_blank"
            >
              10 公里
            </VBtn>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWYmpdvZg=="
              target="_blank"
            >
              30 公里
            </VBtn>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              href="https://mbd.pub/o/bread/YZWZmJZxaQ=="
              target="_blank"
            >
              3.2 公里
            </VBtn>
          </div>
        </VCardText>
        <VCardActions>
          <VBtn variant="text" @click="redeemLinksDialog = false">关闭</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :timeout="3000">
      {{ snackbarMessage }}
    </VSnackbar>
  </div>
</template>

