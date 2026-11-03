-- Portfolio media policy: preserve original image/video files used by the work CMS.
-- The projects table already stores the public category in discipline and the media
-- kind in project_type; this migration only aligns the public storage bucket.
update storage.buckets
set file_size_limit = 524288000,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4'
    ]
where id = 'portfolio-public-assets';
