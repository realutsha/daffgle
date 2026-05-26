/**
 * Utility to calculate the exact current time in Bangladesh Time (BDT, UTC+6).
 * This mathematical conversion is highly robust and timezone-independent.
 */
export function getBangladeshTime(): Date {
  const now = new Date();
  // convert local time to UTC timestamp
  const utcTimestamp = now.getTime() + now.getTimezoneOffset() * 60000;
  // BDT is UTC+6
  const bdtDate = new Date(utcTimestamp + 6 * 3600000);
  return bdtDate;
}

/**
 * Checks whether Night Owl mode is active based on current Bangladesh Time.
 * Night Owl is active from 3:00 AM to 6:00 AM BDT (3:00:00 to 5:59:59).
 */
export function isNightOwlActive(): boolean {
  const bdtNow = getBangladeshTime();
  const hour = bdtNow.getHours();
  return hour >= 3 && hour < 6;
}

/**
 * Returns the current Night Owl State, including active status,
 * BDT time parts, and a pre-formatted ticking countdown to the next state change.
 */
export function getNightOwlState() {
  const bdtNow = getBangladeshTime();
  const hour = bdtNow.getHours();
  const minute = bdtNow.getMinutes();
  const second = bdtNow.getSeconds();

  const isActive = hour >= 3 && hour < 6;
  const targetBDT = new Date(bdtNow.getTime());

  if (isActive) {
    // Active: Countdown to closing time (6:00 AM BDT today)
    targetBDT.setHours(6, 0, 0, 0);
  } else {
    // Inactive: Countdown to opening time (3:00 AM BDT today or tomorrow)
    if (hour >= 6) {
      // It's after 6:00 AM BDT today, next opening is tomorrow at 3:00 AM BDT
      targetBDT.setDate(targetBDT.getDate() + 1);
    }
    targetBDT.setHours(3, 0, 0, 0);
  }

  const diffMs = Math.max(0, targetBDT.getTime() - bdtNow.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hoursLeft = Math.floor(totalSeconds / 3600);
  const minutesLeft = Math.floor((totalSeconds % 3600) / 60);
  const secondsLeft = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeLeftFormatted = `${pad(hoursLeft)}h ${pad(minutesLeft)}m ${pad(secondsLeft)}s`;

  return {
    isActive,
    bdtTime: {
      hour,
      minute,
      second,
    },
    timeLeftFormatted,
  };
}
