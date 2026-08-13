import { normalizePublicIp } from "../utils/request-ip";

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
  const config = input.branch?.locationConfig;
  if (!config || !Number.isFinite(config.latitude) || !Number.isFinite(config.longitude) || !(config.allowedRadius > 0) || !Array.isArray(config.allowedPublicIps) || !config.allowedPublicIps.length) {
    throw new BranchAttendanceGateError("branch_attendance_not_configured");
  }
  const distance = distanceMeters(input.latitude, input.longitude, config.latitude, config.longitude);
  if (distance > config.allowedRadius) throw new BranchAttendanceGateError("outside_radius", distance);
  const requestIp = normalizePublicIp(input.requestIp);
  if (!config.allowedPublicIps.map(normalizePublicIp).includes(requestIp)) throw new BranchAttendanceGateError("network_not_allowed", distance);
  return { distance, requestIp };
}
