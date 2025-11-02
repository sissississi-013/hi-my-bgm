/**
 * rules.js - Focus state rules from interaction signals
 */

const DEFAULTS = {
  idleSeconds: 30,
  tabBurstThreshold: 5,
  tabBurstThresholdShort: 3,
  shortWindowSeconds: 10,
  focusTabLimit: 3,
  mouseIdleDistracted: 15,
  noTypingDistracted: 10,
  tabRateDistracted: 8 // tabs per minute considered distracted
};

function withDefaults(options = {}) {
  return { ...DEFAULTS, ...options };
}

export function isIdle(signals, options = {}) {
  const opts = withDefaults(options);
  return signals.noInputSeconds >= opts.idleSeconds;
}

export function isDistracted(signals, options = {}) {
  const opts = withDefaults(options);
  return (
    (signals.tabSwitches60s ?? 0) >= opts.tabBurstThreshold ||
    (signals.tabSwitches10s ?? 0) >= opts.tabBurstThresholdShort ||
    (signals.tabRatePerMin ?? 0) >= opts.tabRateDistracted ||
    (signals.mouseIdleSeconds >= opts.mouseIdleDistracted &&
      signals.noTypingSeconds >= opts.noTypingDistracted)
  );
}

export function isFocused(signals, options = {}) {
  const opts = withDefaults(options);
  return (
    signals.noTypingSeconds <= 4 &&
    (signals.tabSwitches60s ?? 0) < opts.focusTabLimit &&
    (signals.tabSwitches10s ?? 0) < Math.max(1, opts.tabBurstThresholdShort) &&
    signals.noInputSeconds < opts.idleSeconds
  );
}

export function deriveLabel(signals, options = {}) {
  if (!signals) return 'neutral';
  if (isIdle(signals, options)) return 'idle';
  if (isDistracted(signals, options)) return 'distracted';
  if (isFocused(signals, options)) return 'focused';
  return 'neutral';
}

export default {
  deriveLabel,
  isIdle,
  isDistracted,
  isFocused
};
