// Common timezones list for selector
export const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "(GMT-10:00) Hawaii" },
  { value: "America/Anchorage", label: "(GMT-09:00) Alaska" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time (US & Canada)" },
  { value: "America/Denver", label: "(GMT-07:00) Mountain Time (US & Canada)" },
  { value: "America/Chicago", label: "(GMT-06:00) Central Time (US & Canada)" },
  { value: "America/New_York", label: "(GMT-05:00) Eastern Time (US & Canada)" },
  { value: "America/Sao_Paulo", label: "(GMT-03:00) São Paulo" },
  { value: "Atlantic/Azores", label: "(GMT-01:00) Azores" },
  { value: "UTC", label: "(GMT+00:00) UTC" },
  { value: "Europe/London", label: "(GMT+00:00) London, Dublin" },
  { value: "Europe/Paris", label: "(GMT+01:00) Paris, Berlin, Rome" },
  { value: "Europe/Helsinki", label: "(GMT+02:00) Helsinki, Kyiv, Bucharest" },
  { value: "Africa/Cairo", label: "(GMT+02:00) Cairo" },
  { value: "Europe/Moscow", label: "(GMT+03:00) Moscow, St. Petersburg" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Dubai, Abu Dhabi" },
  { value: "Asia/Karachi", label: "(GMT+05:00) Karachi, Islamabad" },
  { value: "Asia/Kolkata", label: "(GMT+05:30) Mumbai, Kolkata, New Delhi" },
  { value: "Asia/Dhaka", label: "(GMT+06:00) Dhaka" },
  { value: "Asia/Bangkok", label: "(GMT+07:00) Bangkok, Hanoi, Jakarta" },
  { value: "Asia/Singapore", label: "(GMT+08:00) Singapore, Kuala Lumpur" },
  { value: "Asia/Shanghai", label: "(GMT+08:00) Beijing, Shanghai" },
  { value: "Asia/Hong_Kong", label: "(GMT+08:00) Hong Kong" },
  { value: "Australia/Perth", label: "(GMT+08:00) Perth" },
  { value: "Asia/Tokyo", label: "(GMT+09:00) Tokyo, Seoul" },
  { value: "Australia/Adelaide", label: "(GMT+09:30) Adelaide" },
  { value: "Australia/Sydney", label: "(GMT+10:00) Sydney, Melbourne" },
  { value: "Australia/Brisbane", label: "(GMT+10:00) Brisbane" },
  { value: "Pacific/Auckland", label: "(GMT+12:00) Auckland, Wellington" },
  { value: "Pacific/Fiji", label: "(GMT+12:00) Fiji" },
];

export const getBrowserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const getTimezoneLabel = (timezone: string): string => {
  const tz = TIMEZONES.find(t => t.value === timezone);
  return tz ? tz.label : timezone;
};
