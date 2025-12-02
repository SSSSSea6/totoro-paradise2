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
const accessPassword = ref('');
const unlocked = ref(false);

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
  if (!unlocked.value && accessPassword.value !== '982108244Qq') {
    notify('请输入正确的访问密码');
    return;
  }
  if (!unlocked.value) unlocked.value = true;
  if (!ensureLogin()) return;
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
        <div class="flex items-center justify-between">
          <div class="text-h6">自由跑</div>
        </div>

        <VRow dense>
          <VCol cols="12" md="4">
            <VTextField
              v-model="accessPassword"
              type="password"
              label="访问密码"
              variant="outlined"
              placeholder="请输入访问密码"
              :disabled="unlocked"
              hint="正确密码后方可提交自由跑"
              persistent-hint
            />
          </VCol>
        </VRow>

        <VRow dense>
          <VCol cols="12" md="4">
            <VCard elevation="0" variant="outlined" class="px-3 py-2">
              <div class="text-gray-500 text-sm">姓名</div>
              <div class="text-lg font-semibold">{{ displayStuName }}</div>
            </VCard>
          </VCol>
          <VCol cols="12" md="4">
            <VCard elevation="0" variant="outlined" class="px-3 py-2">
              <div class="text-gray-500 text-sm">学号</div>
              <div class="text-lg font-semibold">{{ displayStuNumber }}</div>
            </VCard>
          </VCol>
          <VCol cols="12" md="4">
            <VCard elevation="0" variant="outlined" class="px-3 py-2">
              <div class="text-gray-500 text-sm">学校/校区</div>
              <div class="text-lg font-semibold">{{ displaySchool }}</div>
            </VCard>
          </VCol>
        </VRow>

        <VRow dense>
          <VCol cols="12" md="4">
            <VCard elevation="0" class="px-3 py-2 bg-gray-50">
              <div class="flex items-center gap-2">
                <div>
                  <div class="text-gray-500 text-sm">剩余次数</div>
                  <div class="text-2xl font-bold text-green-600">
                    <span v-if="!loadingCredits">{{ credits }}</span>
                    <span v-else>加载中...</span>
                  </div>
                </div>
                <VBtn
                  icon="mdi-plus"
                  size="small"
                  variant="tonal"
                  color="primary"
                  @click="redeemDialog = true"
                />
              </div>
            </VCard>
          </VCol>
        </VRow>
      </div>

      <VRow dense>
        <VCol cols="12" md="4">
          <VTextField
            v-model.number="km"
            type="number"
            label="目标里程（km）"
            variant="outlined"
            :min="0.5"
            :max="5"
            step="0.01"
            hint="范围 0.5 ~ 5.0 km"
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
        <VCardTitle>兑换次数</VCardTitle>
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
        <VCardTitle>选择次数</VCardTitle>
        <VCardText class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <VBtn color="primary" variant="tonal" size="small" href="https://mbd.pub/o/bread/YZWZl59rZA==" target="_blank">
              1 次
            </VBtn>
            <VBtn color="primary" variant="tonal" size="small" href="https://mbd.pub/o/bread/YZWZl5tyaA==" target="_blank">
              2 次
            </VBtn>
            <VBtn color="primary" variant="tonal" size="small" href="https://mbd.pub/o/bread/YZWZlp9qbA==" target="_blank">
              5 次
            </VBtn>
            <VBtn color="primary" variant="tonal" size="small" href="https://mbd.pub/o/bread/YZWZlpxpaw==" target="_blank">
              10 次
            </VBtn>
            <VBtn color="primary" variant="tonal" size="small" href="https://mbd.pub/o/bread/YZWYmpdvZg==" target="_blank">
              30 次
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
