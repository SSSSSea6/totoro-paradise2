export default interface SunRunSportRequest {
  stuNumber: string;
  runType: string; // 0 for 阳光跑
  monthId?: string; // yyyymm 或者平台定义的月ID，可留空尝试全量
  pageNumber: string;
  rowNumber: string;
  token: string;
}
