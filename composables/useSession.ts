interface Session {
  status?: string;
  msg?: null;
  data?: any;
  obj?: any;
  body?: any;
  obj1?: any;
  resultMap?: any;
  total?: number;
  wxLoginStatus?: number;
  msgList?: unknown[];
  message?: null | string;
  studentId?: string;
  stuNumber?: string;
  stuName?: string;
  phoneNumber?: string;
  schoolName?: string;
  schoolId?: string;
  campusName?: string;
  campusId?: string;
  collegeName?: string;
  collegeId?: null;
  naturalId?: string;
  naturalName?: string;
  className?: null;
  gender?: null;
  headPortrait?: string;
  sex?: string;
  token?: string;
  code?: string;
}

const useSession = () => useState<Session>('totoroSession');

export default useSession;
