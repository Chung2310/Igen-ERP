import { isRequestIpAllowed, normalizePublicIp } from "../utils/request-ip";

export class BranchAttendanceGateError extends Error {
  constructor(public readonly reasonCode: "branch_attendance_not_configured" | "outside_radius" | "network_not_allowed", public readonly distance?: number) { super(reasonCode); }
}

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1), dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function validateBranchAttendance(input: { branch: any; latitude: number; longitude: number; requestIp: string }) {
  const legacy = input.branch?.locationConfig;
  const configured = Array.isArray(input.branch?.attendanceLocations)
    ? input.branch.attendanceLocations
    : legacy ? [{ id: "legacy", name: "Văn phòng chính", type: "office", isActive: true, ...legacy }] : [];
  const locations = configured.filter((location: any) => location?.isActive !== false
    && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && location.allowedRadius > 0
    && (location.type === "business_trip" || (Array.isArray(location.allowedPublicIps) && location.allowedPublicIps.length)));
  if (!locations.length) {
    throw new BranchAttendanceGateError("branch_attendance_not_configured");
  }
  const requestIp = normalizePublicIp(input.requestIp);
  const measured = locations.map((attendanceLocation: any) => ({
    attendanceLocation,
    distance: distanceMeters(input.latitude, input.longitude, attendanceLocation.latitude, attendanceLocation.longitude),
  })).sort((a: any, b: any) => a.distance - b.distance);
  const withinRadius = measured.filter(({ attendanceLocation, distance }: any) => distance <= attendanceLocation.allowedRadius);
  if (!withinRadius.length) throw new BranchAttendanceGateError("outside_radius", measured[0]?.distance);
  const valid = withinRadius.find(({ attendanceLocation }: any) => attendanceLocation.type === "business_trip"
    || attendanceLocation.allowedPublicIps.some((allowedIp: unknown) => isRequestIpAllowed(requestIp, allowedIp)));
  if (!valid) throw new BranchAttendanceGateError("network_not_allowed", withinRadius[0].distance);
  return {
    distance: valid.distance,
    requestIp,
    attendanceLocation: {
      id: String(valid.attendanceLocation.id),
      name: String(valid.attendanceLocation.name),
      type: valid.attendanceLocation.type as "office" | "business_trip",
    },
  };
}
