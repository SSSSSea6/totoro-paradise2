<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useNow } from '@vueuse/core';
import { onMounted, onUnmounted } from 'vue';
import { supabase, supabaseReady } from '~/src/services/supabaseClient';
import TotoroApiWrapper from '~/src/wrappers/TotoroApiWrapper';
import generateRunReq from '~~/src/controllers/generateSunRunExercisesReq';
import generateRoute from '~~/src/utils/generateRoute';

const now = useNow({ interval: 1000 });
const startTime = ref(new Date());
const endTime = ref(new Date());
const timePassed = computed(() => Number(now.value) - Number(startTime.value));
const needTime = ref(0);
const running = ref(false);
const isSubmitting = ref(false);
const isRemoteProcessing = ref(false);
const submittedToQueue = ref(false);
const statusMessage = ref('');
const resultLog = ref('');
const taskId = ref<number | null>(null);
const realtimeChannel = ref<RealtimeChannel | null>(null);

const sunRunPaper = useSunRunPaper();
const { params } = useRoute();
const session = useSession();
const { route } = params as { route: string };
const runned = computed(() => !running.value && !!needTime.value);
const target = computed(() => sunRunPaper.value.runPointList.find((r) => r.pointId === route)!);
const supabaseEnabled = computed(() => supabaseReady && Boolean(supabase));
const isBusy = computed(() => running.value || isSubmitting.value || isRemoteProcessing.value);
const isSuccess = computed(() => runned.value || statusMessage.value.startsWith('🎉'));
const hasTerminalStatus = computed(
  () => isSuccess.value || statusMessage.value.startsWith('❌'),
);

const cleanupRealtime = () => {
  if (supabase && realtimeChannel.value) {
    supabase.removeChannel(realtimeChannel.value);
    realtimeChannel.value = null;
  }
};

const handleStatusUpdate = (task: { status: string; result_log?: string }) => {
  if (!task) return;
  resultLog.value = task.result_log ?? '';
  if (task.status === 'PROCESSING') {
    isRemoteProcessing.value = true;
    statusMessage.value = '任务正在执行中，请稍候...';
    return;
  }
  if (task.status === 'SUCCESS') {
    isRemoteProcessing.value = false;
    statusMessage.value = '🎉 任务成功完成！';
    cleanupRealtime();
    return;
  }
  if (task.status === 'FAILED') {
    isRemoteProcessing.value = false;
    statusMessage.value = '❌ 任务执行失败。';
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

const buildJobPayload = () => ({
  routeId: target.value.pointId,
  taskId: target.value.taskId,
  mileage: sunRunPaper.value.mileage,
  minTime: sunRunPaper.value.minTime,
  maxTime: sunRunPaper.value.maxTime,
  runPoint: target.value,
  session: {
    campusId: session.value.campusId,
    schoolId: session.value.schoolId,
    stuNumber: session.value.stuNumber,
    token: session.value.token,
    phoneNumber: session.value.phoneNumber,
  },
  queuedAt: new Date().toISOString(),
});

const submitJobToQueue = async () => {
  isSubmitting.value = true;
  statusMessage.value = '正在提交任务到队列...';
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
      statusMessage.value = '任务已提交，等待实时更新...';
      handleStatusUpdate({ status: 'PENDING', result_log: '' });
      subscribeToTaskUpdates(data.taskId);
    } else {
      statusMessage.value = `提交失败: ${data.error || '未知错误'}`;
      submittedToQueue.value = false;
    }
  } catch (error) {
    statusMessage.value = '网络请求失败';
    resultLog.value = (error as Error).message;
    submittedToQueue.value = false;
  } finally {
    isSubmitting.value = false;
  }
};

const runLocally = async () => {
  try {
    const { req, endTime: targetTime, adjustedDistance } = await generateRunReq({
      distance: sunRunPaper.value.mileage,
      routeId: target.value.pointId,
      taskId: target.value.taskId,
      token: session.value.token,
      schoolId: session.value.schoolId,
      stuNumber: session.value.stuNumber,
      phoneNumber: session.value.phoneNumber,
      minTime: sunRunPaper.value.minTime,
      maxTime: sunRunPaper.value.maxTime,
    });
    startTime.value = now.value;
    needTime.value = Number(targetTime) - Number(now.value);
    endTime.value = targetTime;
    running.value = true;

    await TotoroApiWrapper.getRunBegin({
      campusId: session.value.campusId,
      schoolId: session.value.schoolId,
      stuNumber: session.value.stuNumber,
      token: session.value.token,
    });

    const res = await TotoroApiWrapper.sunRunExercises(req);
    const runRoute = generateRoute(adjustedDistance, target.value);
    await TotoroApiWrapper.sunRunExercisesDetail({
      pointList: runRoute.mockRoute,
      scantronId: res.scantronId,
      breq: {
        campusId: session.value.campusId,
        schoolId: session.value.schoolId,
        stuNumber: session.value.stuNumber,
        token: session.value.token,
      },
    });

    statusMessage.value = '🎉 跑步完成，请在 App 里查看记录';
    resultLog.value = '本地模式已完成，无需队列。';
  } catch (error) {
    statusMessage.value = '任务执行失败';
    resultLog.value = (error as Error).message;
  } finally {
    running.value = false;
  }
};

const handleRun = async () => {
  if (isBusy.value) return;
  statusMessage.value = '';
  resultLog.value = '';

  if (supabaseEnabled.value && supabase) {
    submittedToQueue.value = true;
    await submitJobToQueue();
  } else {
    await runLocally();
  }
};

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  cleanupRealtime();
});

const goBackSite = () => {
  window.location.href = 'https://nuaaguide.online/';
};

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isBusy.value && !runned.value) {
    e.preventDefault();
    e.returnValue = '跑步还未完成，确定要离开吗？';
  }
}
</script>
<template>
  <p class="text-body-1">已选择路径 {{ target.pointName }}</p>
  <p class="text-body-1 mt-2">请再次确认是否开跑</p>
  <p class="text-body-1 mt-2">开跑时会向龙猫服务器发送请求，所以请尽量不要在开跑后取消</p>
  <VBtn
    v-if="!(supabaseEnabled && submittedToQueue)"
    color="primary my-4"
    append-icon="i-mdi-run"
    :loading="isBusy"
    :disabled="isBusy"
    @click="handleRun"
  >
    {{ supabaseEnabled ? "提交到队列" : "确认开跑" }}
  </VBtn>
  <VAlert v-if="statusMessage" type="info" variant="tonal" class="mt-2">
    {{ statusMessage }}
  </VAlert>
  <p v-if="resultLog" class="mt-2 text-body-2">任务日志：{{ resultLog }}</p>
  <template v-if="running">
    <div class="d-flex justify-space-between mt-4">
      <span>{{ timePassed }}/{{ needTime || 1 }}</span>
      <span>{{ Math.ceil((timePassed / (needTime || 1)) * 100) || 100 }}%</span>
    </div>
    <VProgressLinear
      v-if="timePassed"
      color="primary"
      :model-value="(timePassed / (needTime || 1)) * 100 || 100"
      class="mt-2"
    />
  </template>
  <p v-if="isSuccess" class="mt-4">
    <b>跑步完成，去 App 里看记录吧</b>
  </p>
  <VBtn v-if="hasTerminalStatus" color="secondary" class="mt-4" @click="goBackSite">
    返回NUAA Guide
  </VBtn>
</template>
