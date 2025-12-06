import ky from 'ky';
import type { Point } from '../types/RunPoint';
import type SubmitMornSignRequest from '../types/requestTypes/SubmitMornSignRequest';
import type BasicRequest from '../types/requestTypes/BasicRequest';
import type MorningTaskRequest from '../types/requestTypes/MorningTaskRequest';
import type MorningScoreRequest from '../types/requestTypes/MorningScoreRequest';
import type GetSchoolMonthByTermRequest from '../types/requestTypes/GetSchoolMonthByTermRequest';
import type GetSchoolTermRequest from '../types/requestTypes/GetSchoolTermRequest';
import type GetSunRunArchDetailRequest from '../types/requestTypes/GetSunRunArchDetailRequest';
import type GetSunRunArchRequest from '../types/requestTypes/GetSunRunArchRequest';
import type SunRunExercisesDetailRequest from '../types/requestTypes/SunRunExercisesDetailRequest';
import type SunRunExercisesRequest from '../types/requestTypes/SunRunExercisesRequest';
import type SunRunSportRequest from '../types/requestTypes/SunRunSportRequest';
import type UpdateAppVersionRequest from '../types/requestTypes/UpdateAppVersionRequest';
import type GetAppAdResponse from '../types/responseTypes/GetAppAdResponse';
import type GetAppFrontPageResponse from '../types/responseTypes/GetAppFrontPageResponse';
import type GetAppNoticeResponse from '../types/responseTypes/GetAppNoticeResponse';
import type GetAppSloganResponse from '../types/responseTypes/GetAppSloganResponse';
import type GetLesseeServerResponse from '../types/responseTypes/GetLesseeServerResponse';
import type GetRegisterUrlResponse from '../types/responseTypes/GetRegisterUrlResponse';
import type GetRunBeginResponse from '../types/responseTypes/GetRunBeginResponse';
import type GetSchoolMonthByTermResponse from '../types/responseTypes/GetSchoolMonthByTermResponse';
import type GetSchoolTermResponse from '../types/responseTypes/GetSchoolTermResponse';
import type GetSunRunArchDetailResponse from '../types/responseTypes/GetSunRunArchDetailResponse';
import type GetSunRunArchResponse from '../types/responseTypes/GetSunRunArchResponse';
import type GetSunRunPaperResponse from '../types/responseTypes/GetSunRunPaperResponse';
import type GetMornSignPaperResponse from '../types/responseTypes/GetMornSignPaperResponse';
import type GetMornSignArchDetailResponse from '../types/responseTypes/GetMornSignArchDetailResponse';
import type LoginResponse from '../types/responseTypes/LoginResponse';
import type SunRunExercisesDetailResponse from '../types/responseTypes/SunRunExercisesDetailResponse';
import type SunRunExercisesResponse from '../types/responseTypes/SunRunExercisesResponse';
import type SunRunSportResponse from '../types/responseTypes/SunRunSportResponse';
import type SubmitMorningExercisesResponse from '../types/responseTypes/SubmitMorningExercisesResponse';
import type UpdateAppVersionResponse from '../types/responseTypes/UpdateAppVersionResponse';
import encryptRequestContent from '../utils/encryptRequestContent';

const isServer = typeof window === 'undefined';
// 服务端直接直连目标域，避免容器内回环；客户端仍走本地代理
const prefixUrl = isServer ? 'https://app.xtotoro.com/app' : '/api/totoro';

const TotoroApiWrapper = {
  client: ky.create({
    prefixUrl,
    timeout: 12000,
    retry: {
      limit: 2,
      methods: ['post'],
    },
    headers: {
      // Upstream now rejects text/plain and only accepts application/json
      // even though the body is a raw encrypted string.
      'Content-Type': 'application/json',
      // "Content-Length": "0",
      Host: 'app.xtotoro.com',
      Connection: 'Keep-Alive',
      'Accept-Encoding': 'gzip',
      'User-Agent': isServer
        ? 'TotoroSchool/1.2.16 (iPhone; iOS 26.1; Scale/3.00)'
        : 'okhttp/4.9.0',
    },
  }),

  async getRegisterUrl() {
    return this.client.post('platform/serverlist/getRegisterUrl').json<GetRegisterUrlResponse>();
  },

  async getLesseeServer(code: string) {
    return this.client
      .post('platform/serverlist/getLesseeServer', {
        body: encryptRequestContent({ code }),
      })
      .json<GetLesseeServerResponse>();
  },

  async getAppAd(code: string) {
    return this.client
      .post('platform/serverlist/getAppAd', {
        body: encryptRequestContent({ code }),
      })
      .json<GetAppAdResponse>();
  },

  async login({ token }: { token: string }) {
    return this.client
      .post('platform/login/login', {
        body: encryptRequestContent({
          code: '',
          latitude: '',
          loginWay: '',
          longitude: '',
          password: '',
          phoneNumber: '',
          token,
        }),
      })
      .json<LoginResponse>();
  },

  async getAppSlogan(req: BasicRequest): Promise<GetAppSloganResponse> {
    return this.client
      .post('platform/serverlist/getAppSlogan', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async getAppFrontPage(req: BasicRequest): Promise<GetAppFrontPageResponse> {
    return this.client
      .post('platform/login/getAppFrontPage', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async updateAppVersion(breq: BasicRequest): Promise<UpdateAppVersionResponse> {
    const req: UpdateAppVersionRequest & Record<string, string | number | null> = {
      campusId: breq.campusId,
      schoolId: breq.schoolId,
      token: breq.token,
      version: '1.2.14',
      deviceType: '2',
      stuNumber: breq.stuNumber,
    };
    return this.client
      .post('platform/serverlist/updateAppVersion', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async getAppNotice(req: BasicRequest): Promise<GetAppNoticeResponse> {
    return this.client
      .post('platform/serverlist/getAppNotice', {
        body: encryptRequestContent({ ...req, version: '' }),
      })
      .json();
  },

  async getSunRunPaper(req: BasicRequest): Promise<GetSunRunPaperResponse> {
    return this.client.post('sunrun/getSunrunPaper', { body: encryptRequestContent(req) }).json();
  },

  async getSunRunPaperNew(req: BasicRequest): Promise<GetSunRunPaperResponse> {
    // 新接口（客户端抓包显示使用 sunrunNew/getSunrunPaper）
    return this.client
      .post('sunrunNew/getSunrunPaper', { body: encryptRequestContent(req) })
      .json();
  },

  async getRunBegin(req: BasicRequest) {
    return await this.client
      .post('sunrun/getRunBegin', {
        body: encryptRequestContent(req),
      })
      .json<GetRunBeginResponse>();
  },

  async getFreerunPaper(req: BasicRequest) {
    return this.client
      .post('sunrun/getFreerunPaper', { body: encryptRequestContent(req) })
      .json();
  },

  async sunRunExercises(req: SunRunExercisesRequest): Promise<SunRunExercisesResponse> {
    return this.client
      .post('platform/recrecord/sunRunExercises', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async freeRunExercises(req: any): Promise<SunRunExercisesResponse> {
    // 自由跑使用 recrecordNew/sunRunExercises，runType=1
    return this.client
      .post('platform/recrecordNew/sunRunExercises', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async sunRunExercisesDetail({
    pointList,
    scantronId,
    breq,
  }: {
    pointList: Point[];
    scantronId: string;
    breq: BasicRequest;
  }) {
    const req: SunRunExercisesDetailRequest = {
      pointList,
      scantronId,
      stuNumber: breq.stuNumber,
      token: breq.token,
    };
    return this.client
      .post('platform/recrecord/sunRunExercisesDetail', { json: req })
      .json<SunRunExercisesDetailResponse>();
  },

  async getSchoolTerm(breq: BasicRequest): Promise<GetSchoolTermResponse> {
    const req: GetSchoolTermRequest & Record<string, string | number | null> = {
      schoolId: breq.schoolId,
      token: breq.token,
    };
    return this.client
      .post('platform/course/getSchoolTerm', { body: encryptRequestContent(req) })
      .json();
  },

  async getSchoolMonthByTerm(
    termId: string,
    breq: BasicRequest,
  ): Promise<GetSchoolMonthByTermResponse> {
    const req: GetSchoolMonthByTermRequest & Record<string, string | number | null> = {
      schoolId: breq.schoolId,
      stuNumber: breq.stuNumber,
      token: breq.token,
      termId,
    };
    return this.client
      .post('platform/course/getSchoolMonthByTerm', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async getSunRunArch(
    monthId: string,
    termId: string,
    breq: BasicRequest,
  ): Promise<GetSunRunArchResponse> {
    const req: GetSunRunArchRequest & Record<string, string | number | null> = {
      ...breq,
      runType: '0',
      monthId,
      termId,
    };
    return this.client
      .post('sunrun/getSunrunArch', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async getSunRunArchDetail(
    scoreId: string,
    breq: BasicRequest,
  ): Promise<GetSunRunArchDetailResponse> {
    const req: GetSunRunArchDetailRequest & Record<string, string> = {
      scoreId,
      token: breq.token,
    };
    return this.client
      .post('sunrun/getSunrunArchDetail', {
        body: encryptRequestContent(req),
      })
      .json();
  },

  async getSunRunSport(req: SunRunSportRequest): Promise<SunRunSportResponse> {
    return this.client
      .post('sunrun/getSunrunSport', { body: encryptRequestContent(req) })
      .json<SunRunSportResponse>();
  },

  async getMornSignPaper(req: MorningTaskRequest): Promise<GetMornSignPaperResponse> {
    return this.client
      .post('mornsign/getMornSignPaper', { body: encryptRequestContent(req) })
      .json();
  },

  async getMornSignArchDetail(
    req: MorningScoreRequest,
  ): Promise<GetMornSignArchDetailResponse> {
    return this.client
      .post('mornsign/getMornSignArchDetail', { body: encryptRequestContent(req) })
      .json();
  },

  async submitMorningExercises(
    req: SubmitMornSignRequest,
  ): Promise<SubmitMorningExercisesResponse> {
    return this.client
      .post('platform/recrecord/morningExercises', { body: encryptRequestContent(req) })
      .json();
  },
};

export default TotoroApiWrapper;
