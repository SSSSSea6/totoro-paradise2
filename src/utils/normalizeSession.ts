type AnyObj = Record<string, any>;

const keyMatches = (obj: AnyObj, aliases: string[]) => {
  const lowerMap: Record<string, any> = {};
  Object.keys(obj || {}).forEach((k) => {
    lowerMap[k.toLowerCase()] = obj[k];
  });
  for (const alias of aliases) {
    const v = lowerMap[alias.toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
};

export const normalizeSession = (raw: AnyObj) => {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const containers = [
    raw || {},
    raw?.data || {},
    raw?.obj || {},
    raw?.body || {},
    raw?.obj1 || {},
    raw?.resultMap || {},
  ];

  const pick = (aliases: string[]) => {
    for (const c of containers) {
      const v = keyMatches(c, aliases);
      if (v !== '') return v;
    }
    return '';
  };

  const session = { ...raw };

  const setIf = (key: string, val: any) => {
    if (val !== undefined && val !== null && val !== '') session[key] = val;
  };

  setIf('token', raw.token ?? raw?.code ?? '');
  setIf('campusId', pick(['campusid', 'campus_id', 'campusid']));
  setIf('schoolId', pick(['schoolid', 'school_id']));
  setIf('collegeId', pick(['collegeid', 'college_id', 'naturalId']));
  setIf('schoolName', pick(['schoolName', 'school', 'schoolname']));
  setIf('campusName', pick(['campusName', 'campus', 'schoolName', 'school']));
  setIf(
    'collegeName',
    pick(['collegeName', 'college', 'department', 'institute', 'faculty', 'naturalName']),
  );
  setIf('stuName', pick(['stuName', 'studentName', 'name']));
  setIf('stuNumber', pick(['stuNumber', 'studentId', 'studentNo', 'stuno']));

  return session;
};

export default normalizeSession;
