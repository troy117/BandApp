export const PASSWORD_MAX_LENGTH = 128;
export function passwordMinimum(role) { return role === 'student' ? 4 : 8; }
