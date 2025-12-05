<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '~/src/services/supabaseClient';
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';

const sunrunPaper = useSunRunPaper();
const session = useSession();
const route = useRoute();

const selectValue = ref('');
const customEndTime = ref('');
const isSubmitting = ref(false);
const statusMessage = ref('');
const resultLog = ref('');
const taskId = ref<number | null>(null);
const realtimeChannel = ref<RealtimeChannel | null>(null);
const queueCount = ref<number | null>(null);
const estimatedWaitMs = ref<number | null>(null);
const isQueueLoading = ref(false);

const supabaseEnabled = computed(() => supabaseReady && Boolean(supabase));
const target = computed(() =>
  sunrunPaper.value?.runPointList?.find((r: any) => r.pointId === selectValue.value),
);

const cleanupRealtime = () => {
  if (supabase && realtimeChannel.value) {
    supabase.removeChannel(realtimeChannel.value);
    realtimeChannel.value = null;
  }
};

const formatWait = (ms: number | null) => {
  if (!ms || ms <= 0) return '未知';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}秒`;
  return `${min}分${sec}秒`;
};

const refreshQueueEstimate = async () => {
  if (!supabase) return;
  isQueueLoading.value = true;
  try {
    const { count, error } = await supabase
      .from('Tasks')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'PENDING');
    if (error) throw error;
    queueCount.value = count ?? 0;
    estimatedWaitMs.value = (count ?? 0) * 2.8 * 1000;
  } catch (error) {
    console.warn('[queue-estimate] failed', error);
    queueCount.value = null;
    estimatedWaitMs.value = null;
  } finally {
    isQueueLoading.value = false;
  }
};

const handleStatusUpdate = (task: { status: string; result_log?: string }) => {
  if (!task) return;
  resultLog.value = task.result_log ?? '';
  if (task.status === 'PROCESSING') {
    statusMessage.value = '任务正在执行中，请稍候...';
    return;
  }
  if (task.status === 'SUCCESS') {
    statusMessage.value = '🎉 任务执行成功';
    cleanupRealtime();
    return;
  }
  if (task.status === 'FAILED') {
    statusMessage.value = '任务执行失败';
    cleanupRealtime();
  }
};

const subscribeToTaskUpdates = (id: number) => {
  if (!supabase) return;
  cleanupRealtime();
  realtimeChannel.value = supabase
    .channel(`task-updates-${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'Tasks', filter: `id=eq.${id}` },
      (payload) => handleStatusUpdate(payload.new as { status: string; result_log?: string }),
    )
    .subscribe();
};

const randomSelect = () => {
  const list = sunrunPaper.value?.runPointList || [];
  if (!list.length) return;
  const idx = Math.floor(Math.random() * list.length);
  selectValue.value = list[idx]!.pointId;
};

const buildJobPayload = () => {
  if (!target.value) throw new Error('未选择路线');
  return {
    routeId: target.value.pointId,
    taskId: target.value.taskId,
    mileage: sunrunPaper.value?.mileage,
    minTime: sunrunPaper.value?.minTime,
    maxTime: sunrunPaper.value?.maxTime,
    runPoint: target.value,
    customEndTime: customEndTime.value || null,
    session: {
      campusId: session.value.campusId,
      schoolId: session.value.schoolId,
      stuNumber: session.value.stuNumber,
      token: session.value.token,
      phoneNumber: session.value.phoneNumber,
    },
    queuedAt: new Date().toISOString(),
  };
};

const submitJobToQueue = async () => {
  if (!supabaseEnabled.value) {
    statusMessage.value = '队列未配置，无法提交';
    return;
  }
  if (!target.value) {
    statusMessage.value = '请先选择路线';
    return;
  }

  isSubmitting.value = true;
  statusMessage.value = '正在提交到队列...';
  resultLog.value = '';
  taskId.value = null;

  try {
    const response = await fetch('/api/submitTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildJobPayload()),
    });
    const data = await response.json();

    if (response.status === 202 && data.success) {
      taskId.value = data.taskId;
      statusMessage.value = '任务已提交，可直接离开，稍后查看进度';
      handleStatusUpdate({ status: 'PENDING', result_log: '' });
      subscribeToTaskUpdates(data.taskId);
      if (queueCount.value !== null) queueCount.value = Math.max(0, queueCount.value - 1);
    } else {
      statusMessage.value = `提交失败: ${data.error || '未知错误'}`;
    }
  } catch (error) {
    statusMessage.value = '提交失败';
    resultLog.value = (error as Error).message;
  } finally {
    isSubmitting.value = false;
  }
};

const init = async () => {
  if (!session.value?.token) {
    statusMessage.value = '请先登录';
    return;
  }
  try {
    const data = await TotoroApiWrapper.getSunRunPaper({
      token: session.value.token,
      campusId: session.value.campusId,
      schoolId: session.value.schoolId,
      stuNumber: session.value.stuNumber,
    });
    sunrunPaper.value = data;
    const fromQuery = typeof route.query.route === 'string' ? route.query.route : '';
    selectValue.value = fromQuery || data?.runPointList?.[0]?.pointId || '';
  } catch (error) {
    statusMessage.value = '获取路线失败';
    resultLog.value = (error as Error).message;
  }
};

await init();

onMounted(() => {
  if (supabaseEnabled.value && supabase) {
    refreshQueueEstimate();
  }
});

onUnmounted(() => {
  cleanupRealtime();
});
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <VSelect
        v-model="selectValue"
        :items="sunrunPaper?.runPointList || []"
        item-title="pointName"
        item-value="pointId"
        label="路线"
        variant="outlined"
        class="min-w-64"
      />
      <VBtn variant="outlined" color="primary" append-icon="i-mdi-gesture" @click="randomSelect">
        随机路线
      </VBtn>
      <VBtn
        v-if="supabaseEnabled"
        variant="text"
        :loading="isQueueLoading"
        @click="refreshQueueEstimate"
      >
        刷新队列
      </VBtn>
    </div>

    <VTextField
      v-model="customEndTime"
      type="datetime-local"
      label="自定义完成时间（东八区，可选）"
      hint="留空则使用当前时间随机值，示例：2024-12-05 07:30"
      persistent-hint
      clearable
      variant="outlined"
      class="max-w-80"
    />

    <VBtn
      block
      color="primary"
      size="large"
      :disabled="!target || isSubmitting"
      :loading="isSubmitting"
      @click="submitJobToQueue"
    >
      提交到队列
    </VBtn>
    <div v-if="supabaseEnabled && queueCount !== null" class="text-caption text-gray-600">
      队列待处理：{{ queueCount }}，预估等待 {{ formatWait(estimatedWaitMs) }}
    </div>

    <VAlert v-if="statusMessage" type="info" variant="tonal" class="mt-2">
      <div>{{ statusMessage }}</div>
      <div v-if="resultLog" class="text-caption mt-1">详情：{{ resultLog }}</div>
    </VAlert>

    <div v-if="sunrunPaper?.runPointList?.length" class="h-50vh w-full md:w-50vw">
      <ClientOnly>
        <AMap :target="selectValue" @update:target="selectValue = $event" />
      </ClientOnly>
    </div>
  </div>
</template>
