SELECT
  id,
  college_id,
  club_id,
  title,
  description,
  location,
  start_at,
  end_at,
  capacity,
  registered_count,
  cancelled_at,
  cover_image_url,
  cover_image_public_id,
  registration_url,
  legacy_mongo_id,
  created_at,
  updated_at,
  CASE
    WHEN (cancelled_at IS NOT NULL) THEN 'CANCELLED' :: text
    WHEN (NOW() < start_at) THEN 'UPCOMING' :: text
    WHEN (end_at IS NOT NULL) THEN CASE
      WHEN (NOW() < end_at) THEN 'ONGOING' :: text
      ELSE 'COMPLETED' :: text
    END
    ELSE CASE
      WHEN (start_at < (NOW() - '24:00:00' :: INTERVAL)) THEN 'COMPLETED' :: text
      ELSE 'ONGOING' :: text
    END
  END AS STATUS
FROM
  EVENTS e;