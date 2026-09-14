-- FIU Global Portal academic directory seed.
-- Source: https://www.final.edu.tr/ufu-7-akademik/o-1-fakulteler
-- The source labels the child entries as programs; the portal exposes them as profile departments.
START TRANSACTION;

INSERT INTO dotnet_faculties (id, name, is_active, created_at, updated_at) VALUES
  (1, 'Faculty of Dentistry', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (2, 'Faculty of Pharmacy', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (3, 'Faculty of Educational Sciences', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (4, 'Faculty of Arts and Sciences', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (5, 'Faculty of Law', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (6, 'Faculty of Economics and Administrative Sciences', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (7, 'Faculty of Architecture and Fine Arts', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (8, 'Faculty of Engineering', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (9, 'Faculty of Health Sciences', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  name = VALUES(name), is_active = 1, updated_at = UTC_TIMESTAMP();

INSERT INTO dotnet_departments (id, faculty_id, name, is_active, created_at, updated_at) VALUES
  (1, 1, 'Dentistry (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (2, 1, 'Dentistry (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (3, 2, 'Pharmacy (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (4, 2, 'Pharmacy - 5 Year (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (5, 2, 'Pharmacy - 6 Year (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (6, 3, 'English Language Teaching (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (7, 3, 'Early Childhood Education (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (8, 3, 'Special Education Teaching (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (9, 3, 'Guidance and Psychological Counseling (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (10, 3, 'Turkish Language Teaching (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (11, 4, 'Psychology (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (12, 4, 'Psychology (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (13, 5, 'Law (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (14, 5, 'International Law (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (15, 6, 'Banking, Finance and Accounting (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (16, 6, 'Economics (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (17, 6, 'Business Administration (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (18, 6, 'Marketing - Digital Media (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (19, 6, 'Political Science and International Relations (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (20, 6, 'International Finance and Banking (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (21, 6, 'International Trade and Business Administration (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (22, 6, 'Management Information Systems (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (23, 7, 'Interior Architecture (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (24, 7, 'Architecture (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (25, 8, 'Computer Engineering (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (26, 8, 'Electrical and Electronics Engineering (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (27, 8, 'Civil Engineering (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (28, 8, 'Artificial Intelligence Engineering (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (29, 8, 'Software Engineering (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (30, 9, 'Nutrition and Dietetics (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (31, 9, 'Physiotherapy and Rehabilitation (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (32, 9, 'Physiotherapy and Rehabilitation (Turkish)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (33, 9, 'Nursing (English)', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  faculty_id = VALUES(faculty_id), name = VALUES(name), is_active = 1, updated_at = UTC_TIMESTAMP();

COMMIT;
