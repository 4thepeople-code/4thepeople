/**
 * Event status update cron job (RETIRED)
 *
 * In PostgreSQL, event status is dynamically derived at query time
 * via the security-invoker view `events_with_status`. Periodic background
 * writes to an `events.status` column are no longer required or supported.
 */
const startEventStatusJob = () => {
  return null;
};

const updateEventStatuses = async () => {
  return { count: 0 };
};

module.exports = { startEventStatusJob, updateEventStatuses };
